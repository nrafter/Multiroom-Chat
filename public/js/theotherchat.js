// Parameters.
var task = gup("task");
var role = gup('role') ? gup('role') : '';
var worker = gup('workerId') ? gup('workerId') : sess_id;
var speaking = gup('speak') ? gup('speak') : false;
// Last message ID retrieved from server.
var lastid = -1;
var startOfRound = -1;
//track what posts the worker voter for
var voteConfirmed = new Array();
var voteCount = 0;

var majority = 100;
var spoken = new Array();
var flag = false;
var newMessages = 0;
function fetchHighlights() {
	$.ajax({
		url: "fetch_highlights.php",
		data: {task: task, worker: worker},
		dataType: "json",
		success: function (d) {
			var h = d.highlights;
			var updated = false;
			for (var i = 0; i < h.length; i++) {
				var id = h[i].id + "_highlight";
				if ($("#" + id).length) {
					if (h[i].votes != $("#" + id).attr("score")) {
						$("#" + id).attr('score', h[i].votes);
						updated = true;
					}
				} else {
					updated = true;
					var hLine = $("<li chat_id=" + h[i].chat_id + ">" + h[i].highlight + "</li>");
					hLine.attr('id', id);
					hLine.attr('score', h[i].votes);
					var buttons = $("<div class='plus-minus-buttons'><input type='button' class='minus-button' value='-'><input type='button' class='plus-button' value='+'></div>");
					hLine.prepend(buttons);
					$("#chat-highlights ul").prepend(hLine);
					$("#" + id).click(function (e) {
						var t = e.target;
						highlightToChat($(t).attr('chat_id'));
					})
				}
			}

			if (updated) {
				sortList();
			}
		}
	});
}

var messagesWithoutRequester = 0;

function fetchNew() {
	$.ajax({
		url: "fetch.php?task=" + task + "&lastid=" + lastid,
		dataType: "json",
		success: function (d) {
			var chats = d.chats;

			if (d.done) {
				$("#legion-submit-div").addClass("chat-done");
				$("#legion-submit-instructions").show();
			}

			for (var i = 0; i < chats.length; i++) {
				if (flag) {
					newMessages++;
					$('#newMessages').show();
					$('#newMessages').find('.number').text(newMessages);
				}
				if (chats[i].role != "requester" && chats[i].role != "crowd") {
					continue;
				}

				if (chats[i].role == 'requester') {
					legion_reset_actions();
					abstain_reward(role);
					$("#votes-allowed").text('3');
				}

				var chatLine = $("<li votes='" + chats[i].votes + "' class='messages " + chats[i].role + "' chat_id='" + chats[i].id + "'id='chat_" + chats[i].id + "'status='" + chats[i].status + "'><input class='important-button' type='button' value='Important'><span class='role'>" + chats[i].role + "</span><span class='username'>" + chats[i].user + "</span>: <span class='message'>" + chats[i].chat + "</span> <span class='time'>" + chats[i].time + "</span></li>");
				//only crowd can immediately see posts, requester can see after a majority vote
				$("#chat-area").append(chatLine);
				if (role == "requester") {
					$('input').remove('.important-button');
				}
				//hides posts from the requester if it doesn't have majority support
				if (role == "requester" && $('#chat_' + chats[i].id).attr('status') != 1 && chats[i].role == "crowd") {
					var hide = '#chat_' + chats[i].id;
					$(hide).hide();
				}

				var ImpButton = $('#chat_' + chats[i].id).children('.important-button');
				ImpButton.click(function (e) {
					var t = e.target;
					if ($(t).hasClass('important-button')) {
						var message = $(t).parent().find(".message").html();
						var HLcid = $(t).parent().attr('chat_id');
						highlightMessage(message, t, HLcid);
						$(t).attr("disabled", "disabled");
					}
				});

				if (chats[i].id > lastid) {
					lastid = chats[i].id;
				}

				if (chats[i].role == "requester") {
					playSound("requester");
				} else {
					playSound("crowd");
				}
			}

			if (startOfRound < 0) {
				startOfRound = lastid;
			}

			if (chats.length > 0 && !flag) {
				newMessages = 0;
				$("#chat-area").animate({ scrollTop: $("#chat-area").prop("scrollHeight") }, 3000);
			}

			var valids = d.valid_ids;
			$(".crowd").addClass("invalid").removeClass("inplay");
			$(".user").addClass("set");

			for (var i = 0; i < valids.length; i++) {
				$("#chat_" + valids[i].chat_id).addClass("inplay").removeClass("invalid");
				$("#chat_" + valids[i].chat_id).attr("votes", valids[i].votes);
			}

			recalculateVotes();
			refreshView();

		}
	});
}

var successChats = [];
function trackWorkers() {
	$.ajax({
		url: "worker-feedback.php?task=" + task + "&worker=" + worker,
		dataType: "json",
		success: function (d) {
			var chats = d;
			for (var i = 0; i < d.length; i++) {
				var cid = d[i].chat_id;
				if (cid > startOfRound && $("#chat_" + cid).hasClass('confirmed') && $.inArray(cid, successChats) < 0) {
					successChats.push(cid);
					legion_reward("message_accepted", $("#chat_" + cid));
					$("#chat-accepted-container").stop().show();
					setTimeout(function () {
						$("#chat-accepted-container").stop().hide('slow');
					}, 3000);
					increaseParticipation();
				}
			}
		}
	});
//rewards for voting for an accepted post   
	$(".voted.confirmed").each(function () {
		if ($.inArray($(this).attr('chat_id'), voteConfirmed) == -1) {
			voteConfirmed.push($(this).attr('chat_id'));
			legion_reward("voted_for_accepted", $(this));
			$("#chat-accepted-container").stop().show();
			setTimeout(function () {
				$("#chat-accepted-container").stop().hide('slow');
			}, 3000);
			increaseParticipation();
		}
	});
//returns participation to the worker if a post expires that they voted on. IF USEFUL MAKE OWN FUNCTION AND INSERT IN HERE
	/*    if($(".voted.inplay").length >= voteCount){
	 voteCount = $(".voted").length;
	 }else{
	 for(var i=(voteCount-$(".voted").length); i>0; i--){
	 increaseParticipation();
	 }
	 voteCount = $(".voted").length;
	 }*/
}

function refreshView() {
	$('.inplay').each(function (i, elem) {
		var idx = parseInt($(elem).attr('chat_id'));
		if (!$(elem).hasClass('voted')) {
			var thumbUp = $('<img width=16 src="img/thumb-up.png"></img>');
			var clickhere = $('<span class="clickhere" style="font-weight: bold; float: right; text-decoration:underline; color: #33D; font-size: .9em; padding-right: 0.5em;">Click to Agree!</span><span style="clear: both;"></span>');
			if ($(elem).hasClass('inplay')) {
				if ($(elem).has('img').length == 0) {
					$(elem).append(thumbUp);
					$(elem).append(clickhere);
				}
			}

			$(elem).unbind('click').click(function () {
				//if have votes left and are not voting for their own post
				if (allowParticipation() && $(elem).children('.username').text() != worker && !$(elem).hasClass('confirmed')) {
					$.ajax({
						type: 'POST',
						url: "vote.php",
						data: {task: task, chat_id: idx, worker: worker, role: role},
						dataType: "text",
						success: function (d) {
							if (d == 1) {
								reduceParticipation();
								legion_reward("vote", elem);
							}
							$(elem).addClass('voted');
							$(elem).children('img').remove();
							$(elem).children('.clickhere').remove();
						}
					});
				}
			});
		} else {
			$(elem).unbind('click').click(function () {
				if ($(elem).children('.username').text() != worker && !$(elem).hasClass('confirmed')) {
					$.ajax({
						type: 'POST',
						url: "unvote.php",
						data: {task: task, chat_id: idx, worker: worker, role: role},
						dataType: "text",
						success: function (d) {
							$(elem).attr('votes', (parseInt($(elem).attr('votes')) - 1));
							$(elem).removeClass('voted');
							$(elem).append(thumbUp);
							$(elem).append(clickhere);
						}
					});
				}
			});
		}
	});
	$('.confirmed').children('img').remove();
	$('.confirmed').children('.clickhere').remove();
	$('.invalid').remove();
}

function recalculateVotes() {
	$('.messages').each(function (i, elem) {
		if (parseInt($(elem).attr("votes")) >= majority && $(elem).attr("status") == '0') {
			var idx = parseInt($(elem).attr('chat_id'));
			$.ajax({
				url: "status.php",
				data: {task: task, chat_id: idx},
				dataType: "text",
				success: function (d) {
					$(elem).attr('status', 1);
				}
			});
		}
		if (parseInt($(elem).attr("status")) == 1) {
			$(elem).addClass("confirmed").removeClass('invalid').removeClass('inplay');
			$(elem).children('.time').show();
			if (role == "requester") {
				//remove the hide() from newFetch because there is now majority agreement
				$(elem).show();
				if (speaking == 'true' && $.inArray($(elem).attr('chat_id'), spoken) == -1 && $(elem).hasClass('crowd')) {
					spoken.push($(elem).attr('chat_id'));
					speak($(elem).children('.message').text());
				}
			}
		}
	});
}

function highlightMessage(message, elem, chat_id) {
	$.ajax({
		url: "highlight.php",
		data: {task: task, highlight: message, worker: worker, role: role, cid: chat_id},
		dataType: "text",
		success: function (d) {}
	});
	legion_reward("highlight", elem);
}

var requesterSound = null;
var crowdSound = null;

$(document).ready(function () {
	if (embed_video && role == 'crowd') {
		$("#main-interface").hide();

		var params = { allowScriptAccess: "always" };
		var atts = { id: "myytplayer" };
		swfobject.embedSWF("http://www.youtube.com/v/JhN58FgXwaA?enablejsapi=1&playerapiid=ytplayer&version=3&autoplay=1&controls=0&modestbranding=1&rel=0", "ytapiplayer", "500", "425", "8", null, null, params, atts);

		//  _mute_sounds = true;
		// setFlashVolume(0);

		$("#video-continue-button").click(function () {
			$("#main-interface").show();
			$("#instructional-video").remove();
			// setFlashVolume(1.0);
			// _mute_sounds = false;
			setInterval(getMajority, 500);
		});
	} else {
		$("#instructional-video").remove();
	}
//requester doesn't need to see these
	if (role == "requester") {
		$("#instructions").remove();
		$("#participation").remove();
		$("#container").css("float", "none").css("margin", "auto");
		$('#chat-alert').remove();
		if (speaking == 'true') {
			$('#mike').keypress(function (e) {
				if (e.which == 13) {
					transcribe($('#mike').val());
				}
			});
		} else {
			$("#mike").remove();
		}


		$('#txt').css('float', 'none');
		$('#txt').addClass('req');
	}
//Only the crowd can see the History
	if (role == "crowd") {
		$("#mike").remove();
		$("#sidebar").append($('<div id="chat-highlights"><h2>Important Facts</h2><span id="highlight-instructions">click facts that you think are important to remember, or contribute your own</span><div class="container"><ul id="highlight-list"></ul><textarea class="defaultText defaultTextActive" title="(e.g., located in austin, texas)" id="highlight-enter" cols="10" rows="2"></textarea><div id="tbox-alert">You can now contribute your own "important facts" when appropriate!</div></div></div>'));
		$('#highlight-enter').keypress(function (e) {
			if (e.which == 13) {
				e.preventDefault();
				highlightMessage($("#highlight-enter").val(), $("#highlight-enter"));
				$('#highlight-enter').val('');
			}
		});
		$('#chat-alert').hide();
//hide highlight-enter until threshold is met (5000pts)
		$('#tbox-alert').hide();
		$('#highlight-enter').hide();

		$("#highlight-list").click(function (e) {
			var t = $(e.target);
			if (t.hasClass("plus-button") || t.hasClass("minus-button")) {
				var vote = 1;
				if (t.val() == "-") {
					vote = -1;
				}
				var h_id = parseInt(t.parent().parent().attr('id'));
				if (/\d/.test(h_id)) {
					$.ajax({
						url: "highlight.php",
						data: {task: task, worker: worker, highlight_id: h_id, vote: vote},
						dataType: "text",
						success: function (d) {
							legion_reward("highlight_like", t);
						}
					});
				}
			}
		});
	}

	$("#chat-area").scroll(function () {
		if (flag && $("#chat-area").scrollTop() + 300 == $("#chat-area").prop("scrollHeight")) {
			flag = false;
			newMessages = 0;
			$('#newMessages').hide();
		} else {
			flag = true;
		}
	});
	$('#newMessages').click(function () {
		$("#chat-area").animate({ scrollTop: $("#chat-area").prop("scrollHeight") }, 3000);
	});

	$('.chat-box').keypress(function (e) {
		if (e.which == 13) {
			e.preventDefault();
			if (role == "requester" || allowParticipation()) {
				$.ajax({
					url: "post.php",
					data: {task: task, chat: $(".chat-box").val(), worker: worker, role: role},
					dataType: "text",
					success: function (d) {
						if (role == "crowd" && d.charAt(0) == '{') {
							reduceParticipation();
							legion_reward("message", e.target);
							if (majority == 0) {
								increaseParticipation();
							}
						} else if (role == "crowd" && d != "duplicate" && $("#chat_" + d).attr('status') != 1 && !$("#chat_" + d).hasClass('confirmed')) {
							//convert double post into a vote
							$.ajax({
								type: 'POST',
								url: "vote.php",
								data: {task: task, chat_id: d, worker: worker, role: role},
								dataType: "text",
								success: function (r) {
									if (r == 1) {
										reduceParticipation();
										legion_reward("vote", e.target);
									}
									$("#chat_" + d).addClass('voted');
									$("#chat_" + d).children('img').remove();
									$("#chat_" + d).children('.clickhere').remove();
									$("#chat_" + d).unbind('click');
								}
							});
						}
					}
				});

				$('.chat-box').val('');
			}
		}
	});

	/* $("#chat-area").mousemove(function() {
	 if(!flag){
	 $("#chat-area").stop();
	 }
	 });*/

	$(".defaultText").focus(function (srcc) {
		if ($(this).val() == $(this)[0].title) {
			$(this).removeClass("defaultTextActive");
			$(this).val("");
		}
	});

	$(".defaultText").blur(function () {
		if ($(this).val() == "") {
			$(this).addClass("defaultTextActive");
			$(this).val($(this)[0].title);
		}
	});

	$(".defaultText").blur();

	// set updaters
	fetchNew();
	fetchHighlights();
	setInterval(fetchNew, 1500);
	setInterval(fetchHighlights, 1600);
	//setInterval(getExpirations, 1000);
	setInterval(trackWorkers, 4000);
	intervalID = setInterval(activateHighlightBox, 1000);
	if (role == "requester") {
		setInterval(requesterTyping, 1000);
	}
	setInterval(typing, 1000);
	if ((role == 'crowd' && !embed_video) || role == 'requester') {
		setInterval(getMajority, 500);
	}
});

function playSound(s) {
	switch (s) {
		case "requester":
			requesterSound = soundManager.createSound({
				id: 'requester',
				url: 'sounds/beep-message.mp3'
			});
			soundManager.play('requester');
			break;
		case "crowd":
			crowdSound = soundManager.createSound({
				id: 'crowd',
				url: 'sounds/beep-suggestion.mp3'
			});
			soundManager.play('crowd');
			break;
	}
}

function sortList() {
	var mylist = $("#chat-highlights ul");
	var listitems = mylist.children('li').get();

	listitems.sort(function (a, b) {
		var a_val = parseInt($(a).attr('score'));
		var b_val = parseInt($(b).attr('score'));

		/*if(b_val==a_val) {
		 //console.log("comparing: " + $(b).text() + "||" + $(a).text() + "__" + ($(b).text() < $(a).text()));
		 return ($(b).text() < $(a).text());
		 }*/

		return (a_val - b_val);
	});

	listitems.reverse();

	var nums = [];
	$.each(listitems, function (idx, itm) {
		nums.push(Number(parseInt($(itm).attr("id"))));

		if (idx < 5) {
			$(itm).css('display', 'block');
		} else {
			$(itm).css('display', 'none');
		}

		mylist.append(itm);
	});

	nums.sort(function (a, b) {
		return a - b;
	});
	nums.reverse();

	var num_chosen = 0;
	for (var i = 0; i < nums.length && num_chosen < 3; i++) {
		console.log($("#" + nums[i] + "_highlight").css('display'));
		if ($("#" + nums[i] + "_highlight").css('display') != "block") {
			$("#" + nums[i] + "_highlight").css('display', 'block');
			num_chosen++;
		}
	}

	$("#chat-highlights ul li").removeClass("odd-chat-highlight");
	$("#chat-highlights ul li").filter(":visible").each(function (idx, itm) {
		if (idx % 2 == 0) {
			$(itm).addClass("odd-chat-highlight");
		}
	});
}

function allowParticipation() {
	if (parseInt($("#votes-allowed").text()) > 0) {
		return true;
	} else {
		chatAlerts("restriction");
		return false;
	}
}

function reduceParticipation() {
	var remaining = parseInt($("#votes-allowed").text()) - 1;
	$("#votes-allowed").text(remaining + "");
}

function increaseParticipation() {
	var remaining = parseInt($("#votes-allowed").text()) + 1;
	if (remaining <= 3) {
		$("#votes-allowed").text(remaining + "");
	}
}

function getExpirations() {
	var majority = majority;
	$.ajax({
		type: 'POST',
		url: "expiration.php",
		data: {task: task, worker: worker},
		dataType: "text",
		success: function (d) {
			var refunds = 0;
			refunds = parseInt(d);
			for (i = refunds; i > 0; i--) {
				// alert('expired post');
				increaseParticipation();
			}
		}
	});
}

function abstain_reward(r) {
	if (r == "crowd" && $("#legion-points").text() != "--") {
		legion_reward("abstain", ".chat-box");
		/*$.ajax({
		 type: 'POST',
		 url: "abstain.php",
		 data: {task: task},
		 dataType: "text",
		 success: function(d) {
		 if(d=="1"){
		 legion_reward("abstain", "#chat-box");
		 }
		 }
		 });*/
	}
}

//check if points meet the threshold for highlight participation
function activateHighlightBox() {
	if (parseInt($('#legion-points').text()) >= 5000 && $("textarea:hidden").length != 0) {
		$('#highlight-enter').show();
		chatAlerts('highlight');
		clearInterval(intervalID);
	}
}

function crowdTyping() {
	if ($('.inplay').length > 0) {
		return true;
	} else {
		return false;
	}
}

function requesterTyping() {
	var status;
	if (!$('.chat-box').hasClass('defaultTextActive') && $('.chat-box').val() != "") {
		status = 1;
	} else {
		status = 0;
	}
	$.ajax({
		type: "POST",
		url: "typing.php",
		data: {task: task, role: role, typing: status},
		dataType: 'text',
		success: function (d) {}
	});
}

function typing() {
	if (role == "requester") {
		if (crowdTyping()) {
			$('#typing').text('The crowd is typing...')
		} else {
			$('#typing').text('');
		}
	}
	if (role == "crowd") {
		$.ajax({
			type: "POST",
			url: "typing.php",
			data: {task: task, role: role, typing: '1'},
			dataType: 'text',
			success: function (d) {
				if (d == '1') {
					$('#typing').text('The requester is typing...');
				} else {
					$('#typing').text('');
				}
			}
		});
	}
}

function getMajority() {
	$.ajax({
		type: "POST",
		url: "ajax_whosonline.php",
		data: {task: task, worker: worker, role: role},
		dataType: 'text',
		success: function (d) {
			majority = parseInt(d);
			if (majority > 10) {
				majority = 10;
			}
		}
	});
}

function chatAlerts(a) {
	if (role == "crowd") {
		//alert that worker can't post yet
		if (a == "restriction") {
			$("#chat-alert").stop().show();
			$('#votes-allowed').css('color', 'red');
			setTimeout(function () {
				$("#chat-alert").stop().hide('slow');
				$('#votes-allowed').css('color', 'black');
			}, 3000);
		}
		//enable highlight box
		if (a == "highlight") {
			$("#tbox-alert").stop().show();
			setTimeout(function () {
				$("#tbox-alert").stop().hide('slow');
			}, 3000);
		}
	}
}

function transcribe(value) {
	$(".chat-box").focus();
	$(".chat-box").val(value);
	$("#mike").val('');
}

function speak(str) {
	var div = document.getElementById('speak-div');
	if (!div) {
		div = document.createElement('div');
		div.setAttribute("id", "speak-div");
		div.style.position = "absolute";
		div.style.left = "-1000px";
		document.body.appendChild(div);
	}

	div.innerText = str;
}

function onYouTubePlayerReady(playerId) {
	ytplayer = document.getElementById("myytplayer");
	ytplayer.addEventListener("onStateChange", "onytplayerStateChange");
}

function onytplayerStateChange(s) {
	if (s == 0) {
		$("#video-continue-button").show();
		_score += 2 * _pts_cent;
	}

	$.ajax({
		url: "video_finished.php"
	});
}

function highlightToChat(chat_id) {
	var scrTo = $('#chat_' + chat_id);
	var scrH = $("#chat-area").scrollTop();

//won't scroll for new messages
	flag = true;

	$("#chat-area").animate({
		scrollTop: scrTo.offset().top - $("#chat-area").offset().top + $("#chat-area").scrollTop()
	}, 2000);
	//highlight in chat window
	$('#chat_' + chat_id).addClass("HL");
	setTimeout(function () {
		$('#chat_' + chat_id).removeClass("HL");
	}, 3000);
}