// Copyright 2013 Nicolas Garnier (nivco.las@gmail.com). All Rights Reserved.

// Namespace initialization.
var dmp = dmp || {};
dmp.player = dmp.player || {};


/**
 * Checks if the HTML5 player of the current browser can play most common file formats.
 */
dmp.player.html5PlayerIsWorking = function(){
  try {
    var html5Player = new Audio();
    return html5Player.canPlayType('audio/mpeg') && html5Player.canPlayType('audio/mp4');
  } catch (e) {
    // Starting an HTML5 player failed.
    return false;
  }
};

/**
 * Initializes the Player and starts playing if there is a song.
 */
dmp.player.initPlayer = function(){
  var solution = "html";
  // In the HTML5 player support most formats (like Chrome) then we only use the HTML5 player and not the Flash player.
  if (!swfobject.hasFlashPlayerVersion("9.0.0")) {
    solution = "flash,html";
  }
  // Show an error message after 1 second for users who have a flash blocker when we need flash.
  var flashBlockerDetectionTimer = window.setTimeout(function() {
        $('#flashAlert').show();
    }, 1000);
  // Initialize the Player.
  $("#jqueryPlayerContainer").jPlayer({
      ended: dmp.player.playNext,
      swfPath: "/js",
      errorAlerts: false,
      solution: solution,
      supplied: "mp3,m4a,wav,oga,webma,fla,flac",
      keyEnabled: true,
      preload:"auto",
      error: function(event) {
        // This works around a Chrome bug where long files stop playing/loading after some time.
        var time = $("#jqueryPlayerContainer").data("jPlayer").status.currentTime;
        if (time != 0) {
          dmp.player.playFile(dmp.playlist.getCurrentSongId(), undefined, time);
        } else {
          try {
            $(".artist", $("#file-" + dmp.playlist.getCurrentSongId()))
                .text("Sorry! An error occured while attempting to play this song.")
                .addClass("error").attr("colspan", "2")
                .attr("title", "Your browser might not support this audio format.");
            $(".title", $("#file-" + dmp.playlist.getCurrentSongId())).remove();
          } catch (e) {}
        }
      },
      ready: function() {
        window.clearTimeout(flashBlockerDetectionTimer);
        $('#flashAlert').hide();
        // Start playing if we have songs.
        if (dmp.playlist.getAudioList().length > 0) {
          dmp.player.playNext();
        }
        // Removing the hider.
        $("#hider").hide();
      }
  });
};

/**
 * Depends on looping settings finds the ID of the next song to play and
 * plays it.
 *
 * @param{boolean} fromError true if the last song read resulted in an error and
 *     we immediately skipped it.
 */
dmp.player.playNext = function(e, fromError) {
  var playingIndex = dmp.playlist.getCurrentSongIndex();

  // True if we should stop becasue we are not repeating and we ended the last song of the playlist.
  var shouldStopAtTheEnd = (playingIndex == dmp.playlist.getAudioList().length - 1)
      && $(".jp-repeat-off").is(":visible")
      && (e && e.type != "keydown");

  // If we are not looping on the same song we find the next song's ID
  // If the event is from a keydown we force next song even if looping.
  if ((!($(".jp-repeat-one").is(":visible")) || (e && e.type == "keydown")) && dmp.playlist.getAudioList().length > 1) {
    if ($(".jp-shuffle").is(":visible")) {
      // In the case of shuffle (but not when using arrows to browse) we choose a random song.
      var nextRandomPlayingIndex = Math.floor(Math.random() * dmp.playlist.getAudioList().length);
      while (playingIndex === nextRandomPlayingIndex) {
        nextRandomPlayingIndex = Math.floor(Math.random() * dmp.playlist.getAudioList().length);
      }
      playingIndex = nextRandomPlayingIndex;
    } else {
      // We take the next song's ID or we go back to the start of the list.
      playingIndex = playingIndex == dmp.playlist.getAudioList().length - 1 ?
          0 : playingIndex + 1;
    }
    console.log("Next song index is: " + playingIndex);
    if (playingIndex == 0 && fromError) {
      $("#jqueryPlayerContainer").jPlayer("clearMedia");
      return;
    }
  } else {
    if (playingIndex == 0 && fromError) {
      $("#jqueryPlayerContainer").jPlayer("clearMedia");
      return;
    }
  }

  if (playingIndex == -1) {
    playingIndex = 0;
  }

  var nextSongInfo = dmp.playlist.getAudioList()[playingIndex];
  if (nextSongInfo) {
    console.log("Now playing song: " + nextSongInfo);
    dmp.player.playFile(nextSongInfo.id, shouldStopAtTheEnd);
  } else {
    dmp.playlist.setCurrentSongId("");
  }
};

/**
 * Depends on looping settings finds the ID of the next song to play and
 * plays it.
 *
 * @param{boolean} fromError true if the last song read resulted in an error and
 *     we immediately skipped it.
 */
dmp.player.playPrevious = function(e, fromError) {
  var playingIndex = dmp.playlist.getCurrentSongIndex();
  // If we are not looping on the same song we find the next song's ID or if the event is from a keydown.
  if ($(".jp-repeat").is(":visible") || e.type == "keydown" || e.type == "click") {
    // We take the next song's ID or we go back to the start of the list.
    playingIndex = playingIndex == 0 ?
        dmp.playlist.getAudioList().length - 1 : playingIndex - 1;
    console.log("Next song index is: " + playingIndex);
    if (playingIndex == 0 && fromError) {
      $("#jqueryPlayerContainer").jPlayer("clearMedia");
      return;
    }
  } else {
    if (playingIndex == 0 && fromError) {
      $("#jqueryPlayerContainer").jPlayer("clearMedia");
      return;
    }
  }
  var nextSongInfo = dmp.playlist.getAudioList()[playingIndex];
  if (nextSongInfo) {
    console.log("Now playing song: " + nextSongInfo);
    dmp.player.playFile(nextSongInfo.id);
  } else {
    dmp.playlist.setCurrentSongId("");
  }
};

/**
 * Plays the song of the given ID.
 */
dmp.player.currentlyLoaded = undefined;
dmp.player.playFile = function(songId, stop, tracktime) {
  dmp.playlist.setCurrentSongId(songId);
  dmp.drive.getFileUrl(songId,
      function(fileUrl, fileName, error, fileExtension, isFolder) {
        if (error) {
          dmp.player.playNext(null, true);
        } else if(isFolder) {
            // Do nothing as if it is a folder we're likely to be currently loading its children.
        } else {
          $(".playing").removeClass("playing");
          $("#file-" + songId).addClass("playing");
          if (dmp.player.currentlyLoaded != fileUrl) {
            var setMediaValue = {};
            // map some extensions
              if (fileExtension == "ogg") fileExtension = "oga";
              if (fileExtension == "ogv") fileExtension = "oga";
              if (fileExtension == "webm") fileExtension = "webma";
              if (fileExtension == "mp4") fileExtension = "m4a";
              if (fileExtension == "m4b") fileExtension = "m4a";
              if (fileExtension == "m4r") fileExtension = "m4a";
              if (fileExtension == "m4v") fileExtension = "m4a";
              if (fileExtension == "wave") fileExtension = "wav";
              if (fileExtension == "flv") fileExtension = "fla";
              if (fileExtension == "f4v") fileExtension = "fla";
              if (fileExtension == "f4p") fileExtension = "fla";
              if (fileExtension == "f4a") fileExtension = "fla";
              if (fileExtension == "f4b") fileExtension = "fla";
            setMediaValue[fileExtension] = fileUrl;
            $("#jqueryPlayerContainer").jPlayer("setMedia", setMediaValue);
            dmp.player.currentlyLoaded = fileUrl;
          }
          if (stop) {
            $("#jqueryPlayerContainer").jPlayer("stop");
          } else if (tracktime) {
            $("#jqueryPlayerContainer").jPlayer("play", tracktime);
          } else{
            $("#jqueryPlayerContainer").jPlayer("play");
          }
        }
      }
  );
};

// Key binding shortcuts
$(document).keydown(function(e){
  // Right arrow key.
  if (e.keyCode == 39) {
    dmp.player.playNext(e);
    return false;
  }
  // Left arrow key.
  if (e.keyCode == 37) {
    dmp.player.playPrevious(e);
    return false;
  }
});


