(function() {
    var flashvars = false;
    var params = {
        menu: "false",
        flashvars: "false"
    };
    var attributes = {
        id: "myAudioSWF",
        name: "myAudioSWF",
        allowscriptaccess: "always"
    };

    swfobject.embedSWF("Audio.swf", "audioSWF", "1", "1", "9.0.0","expressInstall.swf", flashvars, params, attributes);
})();

function setFlashVolume(v) {
    if(document.getElementById('myAudioSWF') &&
       document.getElementById('myAudioSWF').setVolume) {
    document.getElementById('myAudioSWF').setVolume(v);
    }

    if(_sound_file && soundManager) {
	var name = soundNameFromFile(_sound_file);
	soundManager.setVolume(name, Math.ceil(v*100.0));
    }
}

function play_startSound(volume) {
    volume = volume || 1.0;
    if(document.getElementById('myAudioSWF').playStart) {
        document.getElementById('myAudioSWF').playStart(volume);
    }
}

function play_stopSound(volume) {
    volume = volume || 1.0;
    if(document.getElementById('myAudioSWF').playStop) {
        document.getElementById('myAudioSWF').playStop(volume);
    }
}