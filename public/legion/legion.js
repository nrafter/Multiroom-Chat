var pointsPerDollar = 200000;
var pointMapping = {"vote": 20, "voted_for_accepted": 1000, "message": 100, "message_accepted": 3000, "highlight": 30, "highlight_like": 10, "abstain": 10};

var _score = 0;
var min_money = 0.02;

var pointRecord = {};

function initPointRecord() {
    for (x in pointMapping) {
        pointRecord[x] = 1;
    }
}

function legion_reset_actions() {
    initPointRecord();
}
initPointRecord();

function legion_reward(action, element) {
    if(pointMapping[action]) {
    	if(action!="abstain"){	// && action!="vote"){
			var scoreIncrement = Math.floor(pointMapping[action] / pointRecord[action]);

        	pointRecord[action]*=3;
        }else{
        	if(action=="abstain"){
        		var scoreIncrement = parseInt($("#votes-allowed").text()) * 5;
        	}/* else {
        		var scoreIncrement = 5;
        	}*/
        }

	if(typeof(element)==undefined) {
	    _score += scoreIncrement;
	    updateScore();

	} else {

            // animate the points coming out of it

	    var curr_x = $(element).offset().left + Math.floor($(element).width()/2);
	    var curr_y = $(element).offset().top + Math.floor($(element).height()/2);

	    var c = $("<div>"+scoreIncrement+"</div>");
            c.width(150);

            c.css('position', 'absolute');
            c.offset({top: curr_y, left: curr_x});

            c.addClass('legion-score-display');
            c.css('opacity', 0.0);

	        $(document.body).append(c);

	        var dest_x = $("#legion-points").offset().left;
	        var dest_y = $("#legion-points").offset().top;

	        var diff_x = dest_x - curr_x;
	        var diff_y = dest_y - curr_y;

            $(c).animate({
		        top:  ((diff_y < 0) ? "-=": "+=") + Math.abs(diff_y),
		        opacity: 1.0
            }, 1600, function() {
		        c.css('width', 'auto');
		        $(c).animate({
                    opacity: 0.5,
		            left: ((diff_x < 0) ? "-=": "+=") + Math.abs(diff_x)
		        }, {
                    duration: 1200,
                    complete: function() {
			            c.remove();
			            _score += scoreIncrement;
			            updateScore();
                    },
                    step: function(now, fx) {
			            if(fx.prop == "opacity") {
                            /*var offset = (now - fx.start);
                              var range = (fx.end - fx.start);
                              
                              var frac = offset / range;
                              var abs = (1 / children);
                              var val = Math.floor(frac / abs);
                              
                              for(var i=score_add.length-val; i<score_add.length; i++) {
				              _score += score_add[i];
				              score_add[i] = 0;
                              }
                              updateScore();*/
			            }
                    }
		        });                
            });
	    }
    }
}

//  Turkify the page.
$(document).ready(function () {
	if(role == "crowd"){
    	$('#sidebar').prepend($('<div id="legion-score"><span id="legion-instructions-top" class="legion-instructions">You have earned ~$<span id="legion-money">0.00</span></span><br/><span class="legion-points" id="legion-points">--</span><br/><span id="legion-instructions-bottom" class="legion-instructions">(depending on quality check)</span></div>'));
	}else{
		$('#sidebar').remove();
	}

    if(gup("assignmentId")!="") {
        // create form
        $('#instructions').append($('<div id="legion-submit-div"><p id="legion-submit-instructions">The HIT is now over. Please submit it for payment. If the button below is disabled, then you did not accumulate enough money to be paid.</p><form id="legion-submit-form"><input type="hidden" name="money" value="0" id="legion-money-field"><input type="hidden" name="assignmentId" id="legion-assignmentId"><input id="legion-submit" type="button" value="Submit HIT"></div>'));

        var jobkey=gup("assignmentId");
        if(gup("hitId")!="") {
	        jobkey += "|" + gup("hitId");
        }

        if(gup("assignmentId") == "ASSIGNMENT_ID_NOT_AVAILABLE") {
	        $('input').attr("DISABLED", "true");
	        _allowSubmit = false;
        } else {
	        _allowSubmit = true;
        }
        $('#legion-assignmentId').attr('value', gup("assignmentId"));
        $("#legion-submit-form").attr('method', 'POST');
    

        if(gup("turkSubmitTo")!="") {
            $("#legion-submit-form").attr('action', gup("turkSubmitTo") + '/mturk/externalSubmit');
        }

        $("#legion-submit").attr("DISABLED", "true");
        $("#legion-submit").click(submitToTurk);
    }
});


function submitToTurk(ev) {
    var m = Math.ceil(parseFloat($("#legion-money").text()) * 100.00) / 100.00;
    alert('Your HIT is being submitted. A quality check will be performed on your work, and you will be paid up to $' + m + ' based on the results. Generally, payments are processed within one hour.');

    if(typeof ev != "undefined") {
	ev.preventDefault();
    }
    $("#legion-submit-form").submit();

    return false;
}

function autoApproveHIT() {
    $.ajax({
	    type: 'POST',
	    url: auto_approve_url,
	    data: "a="+gup("assignmentId"),
	    success: function() {
            setTurkMessage("message_approved");
            autoApproveHIT();
	    },
	    error: function() {
            setTurkMessage("message_error");
	    }
    });
}


function setTurkMessage(id) {
    $("#submission_results .messages").hide();
    $("#"+id).show();
}

function updateScore() {
    $("#legion-points").html(Math.floor(_score));
    var m = Math.round(((_score / pointsPerDollar)) * 1000.0) / 1000.0;
    if(!/\./.test(m)) {
        m += ".000";
    } else if (/\.\d\d$/.test(m)) {
        m += "0";
    } else if (/\.\d$/.test(m)) {
        m += "00";
    }
    $("#legion-money").html(m);
    $("#legion-money-field").attr('value', m);

    if(parseFloat(m) > min_money) {
        $("#legion-submit").removeAttr("DISABLED");
    }
}