'use strict';

var Track = (function() {

  function Track(config) {
    var defaults = {
      "id": "k",
      "url": "./audio/drum_machines/Roland_Tr-808_full__36kick.mp3",
      "gain": -6,
      "fadeOut": "64n",
      "reverb": 0.5,
      "pattern": [1,0,0,0, 0,0,0,0, 1,1,0,1, 0,0,0,0],
      "template": "",
      "$parent": "",
      "pitchShift": 0,
      "trackType": "collection",
      "recordingStreamDestination": false
    };
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  Track.stringToTrackPatternEdits = function(string){
    var patternEdits = string.split("&");
    patternEdits = _.map(patternEdits, function(p){
      var parts = p.split("=");
      return {
        "index": parseInt(parts[0]),
        "patternEdits": _.map(parts[1].split(","), function(pp){ return parseInt(pp); })
      }
    });
    return patternEdits;
  }

  Track.trackPatternEditsToString = function(tracks){
    var patternString = "";
    // add pattern edits if there are any
    var trackPatternEdits = _.map(_.keys(tracks), function(key, i){
      return {
        "patternEdits": tracks[key].patternEdits ? tracks[key].patternEdits.slice(0) : [],
        "index": i
      };
    });
    trackPatternEdits = _.filter(trackPatternEdits, function(t){ return t.patternEdits.length > 0; });
    if (trackPatternEdits.length > 0) {
      trackPatternEdits = _.map(trackPatternEdits, function(t){ return t.index + "=" + t.patternEdits.join(",")});
      patternString = trackPatternEdits.join("&");
    }
    return patternString;
  }

  Track.prototype.init = function(){
    var _this = this;
    var opt = this.opt;

    this.opt.title = opt.title || opt.url.substring(opt.url.lastIndexOf('/')+1);
    this.opt.clipEnd = opt.clipEnd || 0;
    this.opt.duration = opt.duration || 0;
    this.opt.uid = _.uniqueId('track');

    this.loaded = false;
    this.isMuted = false;
    this.isSolo = false;
    this.pattern = this.opt.pattern;
    this.originalPattern = this.pattern.slice(0);
    this.patternEdits = [];
    this.trackType = this.opt.trackType;
    this.recordingStreamDestination = this.opt.recordingStreamDestination;
  };

  Track.prototype.destroy = function(){
    this.loaded = false;
    this.player.dispose();
    this.$el.remove();
  };

  Track.prototype.load = function(){
    this.loadPromise = $.Deferred();
    this.loadPlayer();
    this.loadUI();
    return this.loadPromise;
  };

  Track.prototype.loadPlayer = function(){
    var _this = this;

    // // init player
    // this.reverb = new Tone.Freeverb(this.opt.reverb);
    // this.pitchShift = new Tone.PitchShift(this.opt.pitchShift);
    // this.volume = new Tone.Volume();
    this.playerUrl = this.opt.url;
    this.player = new Tone.Player({
      "url": this.opt.url,
      "volume": this.opt.gain,
      "fadeOut": this.opt.fadeOut,
      "onload": function(){ _this.onPlayerLoad(); }
    });

    if (this.recordingStreamDestination !== false) this.player.connect(this.recordingStreamDestination);
    this.player.toMaster()
    // }).chain(this.pitchShift, this.reverb, Tone.Master);
  };

  Track.prototype.loadUI = function(){
    var _this = this;
    var $html = $(this.opt.template(this.opt));

    $html.attr('data-track', this.opt.id);
    // highlight beats
    var pattern = this.pattern;
    $html.find('.beat').each(function(i){
      if (pattern[i] > 0) $(this).find('input').prop('checked', true);
    });
    this.opt.$parent.append($html);
    this.$el = $html;
    this.$muteButton = $html.find('.mute-button');
    this.$soloButton = $html.find('.solo-button');

    this.$settingsParent = this.opt.$settingsParent;
    this.$settingsDialog = this.$settingsParent.find('.dialog');

  };

  Track.prototype.mute = function(){
    this.isMuted = true;
    this.$el.addClass('muted');
    this.$muteButton.addClass('active');
  };

  Track.prototype.onPlayerLoad = function(){
    console.log("Loaded", this.playerUrl)
    this.loaded = true;
    var dur = this.player.buffer.duration;
    this.opt.duration = dur;
    this.opt.clipEnd = +dur.toFixed(3);
    this.loadPromise.resolve();
  };

  Track.prototype.play = function(time, i, secondsPerSubd){
    if (!this.loaded || this.isMuted) return;
    if (this.pattern[i] <= 0) return;

    // randomize play time
    var _this = this;
    var randomizeMagnitude = 0.1; // increase to make more random
    var randAmount = randomizeMagnitude * secondsPerSubd;
    var randDelta = Math.random() * randAmount;
    var rtime = time + randDelta;

    // randomize volume
    // Tone.Transport.scheduleOnce(function(){
    //   _this.volume.volume.value = _.random(-6, 0);
    // }, rtime-0.001);

    var dur = this.opt.clipEnd > 0 ? this.opt.clipEnd : "32n";
    if (Math.abs(dur-this.opt.duration) <= 0.001) this.player.start(rtime);
    else this.player.start(rtime, 0, dur, 0);
  };

  Track.prototype.setGain = function(db){
    this.player.volume.value = db;
  };

  Track.prototype.setPitchShift = function(pitch){
    if (this.pitchShift) this.pitchShift.pitch = pitch;
  };

  Track.prototype.setReverb = function(roomSize){
    if (this.reverb) this.reverb.roomSize.value = roomSize;
  };

  Track.prototype.showSettings = function(){
    var html = this.opt.settingsTemplate(_.extend({}, this.opt));
    this.$settingsDialog.html(html);
    this.$settingsParent.addClass('active');
  };

  Track.prototype.solo = function(){
    this.isSolo = true;
    this.$el.addClass('solo');
    this.$soloButton.addClass('active');
    this.unmute();
  };

  Track.prototype.toggleMute = function(){
    if (this.isMuted) this.unmute();
    else this.mute();
    return this.isMuted;
  };

  Track.prototype.toggleSolo = function(){
    if (this.isSolo) this.unsolo();
    else this.solo();
    return this.isSolo;
  };

  Track.prototype.unmute = function(){
    this.isMuted = false;
    this.$el.removeClass('muted');
    // this.player.mute = false;
    this.$muteButton.removeClass('active');
  };

  Track.prototype.unsolo = function(){
    this.isSolo = false;
    this.$el.removeClass('solo');
    this.$soloButton.removeClass('active');
  };

  Track.prototype.update = function(track){
    var _this = this;

    // change url
    if (track.url && track.url !== this.playerUrl) {
      this.loadPromise = $.Deferred();
      this.playerUrl = track.url;
      this.loaded = false;
      this.player.load(track.url, function(){
        _this.onPlayerLoad();
      });
    }
    if (track.pattern) {
      this.pattern = track.pattern;
      this.originalPattern = this.pattern.slice(0);
      this.patternEdits = [];
      this.$el.find('.beat').each(function(i){
        if (track.pattern[i] > 0) $(this).find('input').prop("checked", true);
        else $(this).find('input').prop("checked", false);
      });
    }

    if (track.title) {
      var $title = this.$el.find('.track-title-text');
      var title = track.typeLabel + ' ' + track.sequence + ': ' + track.title;
      $title.text(title);
      $title.attr('title', title);
    }

    if (track.url) {
      this.$el.find('.play-audio, .download-audio').attr('href', track.url);
    }
    return this.loadPromise;
  };

  Track.prototype.updatePatternCol = function(col, value) {
    this.pattern[col] = value;

    // keep track of edits
    if (value !== this.originalPattern[col] && this.patternEdits.indexOf(col) < 0) {
      this.patternEdits.push(col);
    } else if (value === this.originalPattern[col]) {
      this.patternEdits = _.without(this.patternEdits, col);
    }
  };

  Track.prototype.updateSetting = function(property, value, $target) {
    // console.log("update", property, value);
    this.opt[property] = value;
    $target.text(value);
    if (property==="gain") this.setGain(value);
    else if (property==="reverb") this.setReverb(value);
    else if (property==="pitchShift") this.setPitchShift(value);
  };

  return Track;

})();
