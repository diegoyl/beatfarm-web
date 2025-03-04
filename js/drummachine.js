// Events
// init() once the page has finished loading.
window.onload = init;
var instruments = ['Kick', 'Snare', 'HiHat', 'Brass', 'Synth'];
var loopLength = 16;

// have to update TRACK CONTROLS UI in index if these are changed
const initial_style = "boombap"
const initial_organic = false // false = generic, true = organic
const initial_complexity = 1
const initial_volume = .8

var track_style = [initial_style,initial_style,initial_style,initial_style,initial_style];
var track_organic = [initial_organic,initial_organic,initial_organic,initial_organic,initial_organic]; 
var track_complexity = [initial_complexity,initial_complexity,initial_complexity,initial_complexity,initial_complexity];
var track_volume = [initial_volume,initial_volume,initial_volume,initial_volume,initial_volume];
var instrumentActive = [true,true,true,true,true]

var startAlertAlive = true;

var timerWorker = null; // Worker thread to send us scheduling messages.
var context;
var convolver;
var compressor;
var masterGainNode;
var effectLevelNode;
var filterNode;

// Each effect impulse response has a specific overall desired dry and wet volume.
// For example in the telephone filter, it's necessary to make the dry volume 0 to correctly hear the effect.
var effectDryMix = 1.0;
var effectWetMix = 1.0;

var timeoutId;

var startTime;
var lastDrawTime = -1;

var instSamples;

var kNumInstruments = 5;
var kMaxSwing = .08;

var currentKit;

var beatReset = {"effectIndex":0,"tempo":100,"swingFactor":0,"effectMix":0.25,"kickPitchVal":0.5,"snarePitchVal":0.5,"hihatPitchVal":0.5,"brassPitchVal":0.5,"synthPitchVal":0.5,"rhythm1":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rhythm2":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rhythm3":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rhythm4":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rhythm5":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],};
var beatDemo = [
    {"effectIndex":11,"tempo":120,"swingFactor":0,"effectMix":0.19718309859154926,
        "kickPitchVal":0.5,"snarePitchVal":0.5,"hihatPitchVal":0.5,"brassPitchVal":0.5,"synthPitchVal":0.5,
        "rhythm1": window.parseRawRhythm(window.PATTERNLIB["kick"][initial_style][initial_complexity-1]),
        "rhythm2":window.parseRawRhythm(window.PATTERNLIB["snare"][initial_style][initial_complexity-1]),
        "rhythm3":window.parseRawRhythm(window.PATTERNLIB["hihat"][initial_style][initial_complexity-1]),
        "rhythm4":window.parseRawRhythm(window.PATTERNLIB["brass"][initial_style][initial_complexity-1]),
        "rhythm5":window.parseRawRhythm(window.PATTERNLIB["synth"][initial_style][initial_complexity-1]),
    },
];

function cloneBeat(source) {
    var beat = new Object();
    
    beat.effectIndex = source.effectIndex;
    beat.tempo = source.tempo;
    beat.swingFactor = source.swingFactor;
    beat.effectMix = source.effectMix;
    beat.kickPitchVal = source.kickPitchVal;
    beat.snarePitchVal = source.snarePitchVal;
    beat.hihatPitchVal = source.hihatPitchVal;
    beat.brassPitchVal = source.brassPitchVal;
    beat.synthPitchVal = source.synthPitchVal;
    beat.rhythm1 = source.rhythm1.slice(0);        // slice(0) is an easy way to copy the full array
    beat.rhythm2 = source.rhythm2.slice(0);
    beat.rhythm3 = source.rhythm3.slice(0);
    beat.rhythm4 = source.rhythm4.slice(0);
    beat.rhythm5 = source.rhythm5.slice(0);
    
    return beat;
}

// theBeat is the object representing the current beat/groove
// ... it is saved/loaded via JSON
var theBeat = cloneBeat(beatReset);

kickPitch = snarePitch = hihatPitch = brassPitch = synthPitch = 0;

var mouseCapture = null;
var mouseCaptureOffset = 0;

var rhythmIndex = 0;
var kMinTempo = 53;
var kMaxTempo = 180;
var noteTime = 0.0;



var kitCount = 0;

var kitName = [
    "R8",
    "CR78",
    "KPR77",
    "LINN",
    "Kit3",
    "Kit8",
    "Techno",
    "Stark",
    "breakbeat8",
    "breakbeat9",
    "breakbeat13",
    "acoustic-kit",
    "4OP-FM",
    "TheCheebacabra1",
    "TheCheebacabra2"
    ];

var kitNamePretty = [
    "Roland R-8",
    "Roland CR-78",
    "Korg KPR-77",
    "LinnDrum",
    "Kit 3",
    "Kit 8",
    "Techno",
    "Stark",
    "Breakbeat 8",
    "Breakbeat 9",
    "Breakbeat 13",
    "Acoustic Kit",
    "4OP-FM",
    "The Cheebacabra 1",
    "The Cheebacabra 2"
    ];

var instSamplesName = [
    'boombap',
    'westcoast',
    'trap',
    'neptunes',
    'organic',
];

var instSamplesNamePretty = [
    "Boom-Bap",
    "West Coast",
    "Trap",
    "Neptunes",
    "Organic",
];

function Kit(name) {
    this.name = name;

    this.pathName = function() {
        var pathName = "samples/"+initial_style+"/";
        return pathName;
    };

    this.kickBuffer = 0;
    this.snareBuffer = 0;
    this.hihatBuffer = 0;

    this.instrumentCount = kNumInstruments;
    this.instrumentLoadCount = 0;
    
    this.startedLoading = false;
    this.isLoaded = false;
    
    this.demoIndex = -1;
}

Kit.prototype.setDemoIndex = function(index) {
    this.demoIndex = index;
}

Kit.prototype.load = function() {
    if (this.startedLoading)
        return;
        
    this.startedLoading = true;
        
    var pathName = this.pathName();

    var kickPath = pathName + "kick.wav";
    var snarePath = pathName + "snare.wav";
    var hihatPath = pathName + "hihat.wav";
    var brassPath = pathName + "brass.wav";
    var synthPath = pathName + "synth.wav";

    this.loadSample(0, kickPath, false);
    this.loadSample(1, snarePath, false);
    this.loadSample(2, hihatPath, false);  // we're panning only the hihat / d: JK
    this.loadSample(3, brassPath, false);
    this.loadSample(4, synthPath, false);
}

var decodedFunctions = [
function (buffer) { this.kickBuffer = buffer; },
function (buffer) { this.snareBuffer = buffer; },
function (buffer) { this.hihatBuffer = buffer; },
function (buffer) { this.brassBuffer = buffer; },
function (buffer) { this.synthBuffer = buffer; }, ];

Kit.prototype.loadSample = function(sampleID, url, mixToMono) {
    // Load asynchronously

    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    var kit = this;

    request.onload = function() {
        context.decodeAudioData(request.response, decodedFunctions[sampleID].bind(kit));

        kit.instrumentLoadCount++;
        if (kit.instrumentLoadCount == kit.instrumentCount) {
            kit.isLoaded = true;

            if (kit.demoIndex != -1) {
                beatDemo[kit.demoIndex].setKitLoaded();
            }
        }
    }

    request.send();
}

var impulseResponseInfoList = [
    // Impulse responses - each one represents a unique linear effect.
    {"name":"No Effect", "url":"undefined", "dryMix":1, "wetMix":0},
    {"name":"Spreader 2", "url":"impulse-responses/noise-spreader1.wav",        "dryMix":1, "wetMix":1},
    {"name":"Spring Reverb", "url":"impulse-responses/feedback-spring.wav",     "dryMix":1, "wetMix":1},
    {"name":"Space Oddity", "url":"impulse-responses/filter-rhythm3.wav",       "dryMix":1, "wetMix":0.7},
    {"name":"Huge Reverse", "url":"impulse-responses/matrix6-backwards.wav",    "dryMix":0, "wetMix":0.7},
    {"name":"Telephone Filter", "url":"impulse-responses/filter-telephone.wav", "dryMix":0, "wetMix":1.2},
    {"name":"Lopass Filter", "url":"impulse-responses/filter-lopass160.wav",    "dryMix":0, "wetMix":0.5},
    {"name":"Hipass Filter", "url":"impulse-responses/filter-hipass5000.wav",   "dryMix":0, "wetMix":4.0},
    {"name":"Comb 1", "url":"impulse-responses/comb-saw1.wav",                  "dryMix":0, "wetMix":0.7},
    {"name":"Comb 2", "url":"impulse-responses/comb-saw2.wav",                  "dryMix":0, "wetMix":1.0},
    {"name":"Cosmic Ping", "url":"impulse-responses/cosmic-ping-long.wav",      "dryMix":0, "wetMix":0.9},
    {"name":"Kitchen", "url":"impulse-responses/house-impulses/kitchen-true-stereo.wav", "dryMix":1, "wetMix":1},
    {"name":"Living Room", "url":"impulse-responses/house-impulses/dining-living-true-stereo.wav", "dryMix":1, "wetMix":1},
    {"name":"Living-Bedroom", "url":"impulse-responses/house-impulses/living-bedroom-leveled.wav", "dryMix":1, "wetMix":1},
    {"name":"Dining-Far-Kitchen", "url":"impulse-responses/house-impulses/dining-far-kitchen.wav", "dryMix":1, "wetMix":1},
    {"name":"Medium Hall 1", "url":"impulse-responses/matrix-reverb2.wav",      "dryMix":1, "wetMix":1},
    {"name":"Medium Hall 2", "url":"impulse-responses/matrix-reverb3.wav",      "dryMix":1, "wetMix":1},
    {"name":"Peculiar", "url":"impulse-responses/peculiar-backwards.wav",       "dryMix":1, "wetMix":1},
    {"name":"Backslap", "url":"impulse-responses/backslap1.wav",                "dryMix":1, "wetMix":1},
    {"name":"Diffusor", "url":"impulse-responses/diffusor3.wav",                "dryMix":1, "wetMix":1},
    {"name":"Huge", "url":"impulse-responses/matrix-reverb6.wav",               "dryMix":1, "wetMix":0.7},
]

var impulseResponseList = 0;

function ImpulseResponse(url, index) {
    this.url = url;
    this.index = index;
    this.startedLoading = false;
    this.isLoaded_ = false;
    this.buffer = 0;
    
    this.demoIndex = -1; // no demo
}

ImpulseResponse.prototype.setDemoIndex = function(index) {
    this.demoIndex = index;
}

ImpulseResponse.prototype.isLoaded = function() {
    return this.isLoaded_;
}

function loadedImpulseResponse(buffer) {
    this.buffer = buffer;
    this.isLoaded_ = true;
    
    if (this.demoIndex != -1) {
        beatDemo[this.demoIndex].setEffectLoaded();
    }
}

ImpulseResponse.prototype.load = function() {
    if (this.startedLoading) {
        return;
    }
    
    this.startedLoading = true;

    // Load asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", this.url, true);
    request.responseType = "arraybuffer";
    this.request = request;
    
    var asset = this;

    request.onload = function() {
        context.decodeAudioData(request.response, loadedImpulseResponse.bind(asset) );
    }

    request.send();
}

function startLoadingAssets() {
    impulseResponseList = new Array();

    for (i = 0; i < impulseResponseInfoList.length; i++) {
        impulseResponseList[i] = new ImpulseResponse(impulseResponseInfoList[i].url, i);
    }
    
    // Initialize drum kits
    currentKit = new Kit("main");

    // Initialize Generic Samples
    var numInstSamples = instSamplesName.length;
    instSamples = new Array(numInstSamples);
    for (var i  = 0; i < numInstSamples; i++) {
        instSamples[i] = new InstrumentSamples(instSamplesName[i]);
    }  
    //whr
    
    // Start loading the assets used by the presets first, in order of the presets.
    for (var demoIndex = 0; demoIndex < beatDemo.length; ++demoIndex) {
        var effect = impulseResponseList[beatDemo[demoIndex].effectIndex];
        
        // These effects and kits will keep track of a particular demo, so we can change
        // the loading status in the UI.
        effect.setDemoIndex(demoIndex);
        currentKit.setDemoIndex(demoIndex);
        
        effect.load();
        currentKit.load();
    }
    
    // Then load the remaining assets.

    for (var i  = 0; i < numInstSamples; i++) {
        instSamples[i].load();
    }  

    // Start at 1 to skip "No Effect"
    for (i = 1; i < impulseResponseInfoList.length; i++) {
        impulseResponseList[i].load();
    }
    
    // Setup initial drumkit
    // currentKit = kits[kInitialKitIndex];
    //TODO:set initial sample mappings?

}

function demoButtonURL(demoIndex) {
    var n = demoIndex + 1;
    var demoName = "demo" + n;
    var url = "images/btn_" + demoName + ".png";
    return url;
}

// This gets rid of the loading spinner in each of the demo buttons.
function showDemoAvailable(demoIndex /* zero-based */) {
    // var url = demoButtonURL(demoIndex);
    // var n = demoIndex + 1;
    // var demoName = "demo" + n;
    // var demo = document.getElementById(demoName);
    // demo.src = url;
    
    // Enable play button and assign it to demo 2.
    if (demoIndex == 0) {
        showPlayAvailable();
        loadBeat(beatDemo[0]);

        setTimeout(() => {
            document.getElementById('fadein-container').classList.add('fadeOut');
            document.getElementById('realBody').classList.add('showCusReady');    
        }, 500)

    // Uncomment to allow autoplay
    //     handlePlay();
    }
}

// This gets rid of the loading spinner on the play button.
function showPlayAvailable() {
    var play = document.getElementById("play");
    play.src = "img/btn_play.png";
}

function init() {
    // Let the beat demos know when all of their assets have been loaded.
    // Add some new methods to support this.
    for (var i = 0; i < beatDemo.length; ++i) {
        beatDemo[i].index = i;
        beatDemo[i].isKitLoaded = false;
        beatDemo[i].isEffectLoaded = false;

        beatDemo[i].setKitLoaded = function() {
            this.isKitLoaded = true;
            this.checkIsLoaded();
        };

        beatDemo[i].setEffectLoaded = function() {
            this.isEffectLoaded = true;
            this.checkIsLoaded();
        };

        beatDemo[i].checkIsLoaded = function() {
            if (this.isLoaded()) {
                showDemoAvailable(this.index); 
            }
        };

        beatDemo[i].isLoaded = function() {
            return this.isKitLoaded && this.isEffectLoaded;
        };
    }
        
    startLoadingAssets();

    // NOTE: THIS NOW RELIES ON THE MONKEYPATCH LIBRARY TO LOAD
    // IN CHROME AND SAFARI (until they release unprefixed)
    context = new AudioContext();

    var finalMixNode;
    if (context.createDynamicsCompressor) {
        // Create a dynamics compressor to sweeten the overall mix.
        compressor = context.createDynamicsCompressor();
        compressor.connect(context.destination);
        finalMixNode = compressor;
    } else {
        // No compressor available in this implementation.
        finalMixNode = context.destination;
    }

    // create master filter node
    filterNode = context.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.value = 0.5 * context.sampleRate;
    filterNode.Q.value = 1;
    filterNode.connect(finalMixNode);
    
    // Create master volume.
    masterGainNode = context.createGain();
    masterGainNode.gain.value = 0.7; // reduce overall volume to avoid clipping
    masterGainNode.connect(filterNode);

    // Create effect volume.
    effectLevelNode = context.createGain();
    effectLevelNode.gain.value = 1.0; // effect level slider controls this
    effectLevelNode.connect(masterGainNode);

    // Create convolver for effect
    convolver = context.createConvolver();
    convolver.connect(effectLevelNode);

/////TAKEOUT1
    // var elKitCombo = document.getElementById('kitcombo');
    // elKitCombo.addEventListener("mousedown", handleKitComboMouseDown, true);

    // var elEffectCombo = document.getElementById('effectcombo');
    // elEffectCombo.addEventListener("mousedown", handleEffectComboMouseDown, true);

    // document.body.addEventListener("mousedown", handleBodyMouseDown, true);
/////TAKEOUT1

    initControls();
    updateControls();

    var timerWorkerBlob = new Blob([
        "var timeoutID=0;function schedule(){timeoutID=setTimeout(function(){postMessage('schedule'); schedule();},100);} onmessage = function(e) { if (e.data == 'start') { if (!timeoutID) schedule();} else if (e.data == 'stop') {if (timeoutID) clearTimeout(timeoutID); timeoutID=0;};}"]);

    // Obtain a blob URL reference to our worker 'file'.
    var timerWorkerBlobURL = window.URL.createObjectURL(timerWorkerBlob);

    timerWorker = new Worker(timerWorkerBlobURL);
    timerWorker.onmessage = function(e) {
      schedule();
    };
    timerWorker.postMessage('init'); // Start the worker.

}

function initControls() {
    // Initialize note buttons
    initButtons();

/////TAKEOUT2
    // makeKitList();
    // makeEffectList();
/////TAKEOUT2

    // sliders COMPLEXITYHERE VOLUMEHERE
    // tool buttons
    document.getElementById('play').addEventListener('mousedown', handlePlay, true);
    document.getElementById('stop').addEventListener('mousedown', handleStop, true);

    
    // STYLEHERE


}

function initButtons() {        
    var elButton;

    for (i = 0; i < loopLength; ++i) {
        for (j = 0; j < kNumInstruments; j++) {
                elButton = document.getElementById(instruments[j] + '_' + i);
                elButton.addEventListener("mousedown", handleButtonMouseDown, true);
        }
    }
}

/////TAKEOUT2

// function makeEffectList() {
//     var elList = document.getElementById('effectlist');
//     var numEffects = impulseResponseInfoList.length;

    
//     var elItem = document.createElement('li');
//     elItem.innerHTML = 'None';
//     elItem.addEventListener("mousedown", handleEffectMouseDown, true);
    
//     for (var i = 0; i < numEffects; i++) {
//         var elItem = document.createElement('li');
//         elItem.innerHTML = impulseResponseInfoList[i].name;
//         elList.appendChild(elItem);
//         elItem.addEventListener("mousedown", handleEffectMouseDown, true);
//     }
// }

// function makeKitList() {
//     var elList = document.getElementById('kitlist');
//     var numKits = kitName.length;
    
//     for (var i = 0; i < numKits; i++) {
//         var elItem = document.createElement('li');
//         elItem.innerHTML = kitNamePretty[i];
//         elList.appendChild(elItem);
//         elItem.addEventListener("mousedown", handleKitMouseDown, true);
//     }
// }

/////TAKEOUT2

function advanceNote() {
    // Advance time by a 16th note...
    var secondsPerBeat = 60.0 / theBeat.tempo;

    rhythmIndex++;
    if (rhythmIndex == loopLength) {
        rhythmIndex = 0;
    }

        // apply swing    
    if (rhythmIndex % 2) {
        noteTime += (0.25 + kMaxSwing * theBeat.swingFactor) * secondsPerBeat;
    } else {
        noteTime += (0.25 - kMaxSwing * theBeat.swingFactor) * secondsPerBeat;
    }
}

function playNote(buffer, pan, x, y, z, sendGain, mainGain, playbackRate, noteTime) {
    // Create the note
    var voice = context.createBufferSource();
    voice.buffer = buffer;
    voice.playbackRate.value = playbackRate;

    // Optionally, connect to a panner
    // var finalNode;
    var finalNode = voice;
    // if (pan) {
    //     var panner = context.createPanner();
    //     panner.panningModel = "HRTF";
    //     panner.setPosition(x, y, z);
    //     voice.connect(panner);
    //     finalNode = panner;
    // } else {
    //     finalNode = voice;
    // }

    // Connect to dry mix
    var dryGainNode = context.createGain();
    dryGainNode.gain.value = mainGain * effectDryMix;
    finalNode.connect(dryGainNode);
    dryGainNode.connect(masterGainNode);

    // Connect to wet mix
    var wetGainNode = context.createGain();
    wetGainNode.gain.value = mainGain * sendGain;
    finalNode.connect(wetGainNode);
    wetGainNode.connect(convolver);

    voice.start(noteTime);
}

function schedule() {
    var currentTime = context.currentTime;

    // The sequence starts at startTime, so normalize currentTime so that it's 0 at the start of the sequence.
    currentTime -= startTime;

    while (noteTime < currentTime + 0.120) {
        // Convert noteTime to context time.
        var contextPlayTime = noteTime + startTime;
        
        // function playNote(buffer, pan, x, y, z, sendGain, mainGain, playbackRate, noteTime) {
        
        // Kick
        if (theBeat.rhythm1[rhythmIndex] && instrumentActive[0]) {
            playNote(currentKit.kickBuffer, false, 0,0,-2, 0.5, track_volume[0] * 1.0, kickPitch, contextPlayTime);
        }

        // Snare
        if (theBeat.rhythm2[rhythmIndex] && instrumentActive[1]) {
            playNote(currentKit.snareBuffer, false, 0,0,-2, .5, track_volume[1] * 1.0, snarePitch, contextPlayTime);
        }

        // Hihat
        if (theBeat.rhythm3[rhythmIndex] && instrumentActive[2]) {
            // Pan the hihat according to sequence position.
            playNote(currentKit.hihatBuffer, true, 0,0,-2, .5, track_volume[2] * 1.0, hihatPitch, contextPlayTime);
        }

        // Toms    
        if (theBeat.rhythm4[rhythmIndex] && instrumentActive[3]) {
            playNote(currentKit.brass, false, 0,0,-2, .5, track_volume[3] * 1.0, brassPitch, contextPlayTime);
        }

        if (theBeat.rhythm5[rhythmIndex] && instrumentActive[4]) {
            playNote(currentKit.synth, false, 0,0,-2, .5, track_volume[4] * 1.0, synthPitch, contextPlayTime);
        }

        
        // Attempt to synchronize drawing time with sound
        if (noteTime != lastDrawTime) {
            lastDrawTime = noteTime;
            drawPlayhead((rhythmIndex + 15) % 16);
        }

        advanceNote();
    }
}

function playDrum(noteNumber, velocity) {

    switch (noteNumber) {
        case 0x24:
            playNote(currentKit.kickBuffer,  false, 0,0,-2,  0.5, (velocity / 127), kickPitch,  0);
            break;
        case 0x26:
            playNote(currentKit.snareBuffer, false, 0,0,-2,  1,   (velocity / 127), snarePitch, 0);
            break;
        case 0x28:
            playNote(currentKit.hihatBuffer, true,  0,0,-1.0,1,   (velocity / 127), hihatPitch, 0);
            break;
        case 0x2d:
            playNote(currentKit.brass,        false, 0,0,-2,  1,   (velocity / 127), brassPitch,  0);
            break;
        case 0x2f:
            playNote(currentKit.synth,        false, 0,0,-2,  1,   (velocity / 127), synthPitch,  0);
            break;
        default:
            console.log("note:0x" + noteNumber.toString(16) );
    }
}

function handleSliderMouseDown(event) {
    mouseCapture = event.target.id;

    // calculate offset of mousedown on slider
    var el = event.target;
    if (mouseCapture == 'swing_thumb') {
        var thumbX = 0;    
        do {
            thumbX += el.offsetLeft;
        } while (el = el.offsetParent);

        mouseCaptureOffset = event.pageX - thumbX;
    } else {
        var thumbY = 0;    
        do {
            thumbY += el.offsetTop;
        } while (el = el.offsetParent);

        mouseCaptureOffset = event.pageY - thumbY;
    }
}


function handleMouseMove(event) {
    if (!mouseCapture) return;
    
    var elThumb = document.getElementById(mouseCapture);
    var elTrack = elThumb.parentNode;

    if (mouseCapture != 'swing_thumb') {
        var thumbH = elThumb.clientHeight;
        var trackH = elTrack.clientHeight;
        var travelH = trackH - thumbH;

        var trackY = 0;
        var el = elTrack;
        do {
            trackY += el.offsetTop;
        } while (el = el.offsetParent);

        var offsetY = Math.max(0, Math.min(travelH, event.pageY - mouseCaptureOffset - trackY));
        var value = 1.0 - offsetY / travelH;
        elThumb.style.top = travelH * (1.0 - value) + 'px';
    } else {
        var thumbW = elThumb.clientWidth;
        var trackW = elTrack.clientWidth;
        var travelW = trackW - thumbW;

        var trackX = 0;
        var el = elTrack;
        do {
            trackX += el.offsetLeft;
        } while (el = el.offsetParent);

        var offsetX = Math.max(0, Math.min(travelW, event.pageX - mouseCaptureOffset - trackX));
        var value = offsetX / travelW;
        elThumb.style.left = travelW * value + 'px';
    }

    sliderSetValue(mouseCapture, value);
}

function handleMouseUp() {
    mouseCapture = null;
}

function sliderSetValue(slider, value) {
    var pitchRate = Math.pow(2.0, 2.0 * (value - 0.5));
    
    switch(slider) {
    case 'effect_thumb':
        // Change the volume of the convolution effect.
        theBeat.effectMix = value;
        setEffectLevel(theBeat);            
        break;
    case 'kick_thumb':
        theBeat.kickPitchVal = value;
        kickPitch = pitchRate;
        break;
    case 'snare_thumb':
        theBeat.snarePitchVal = value;
        snarePitch = pitchRate;
        break;
    case 'hihat_thumb':
        theBeat.hihatPitchVal = value;
        hihatPitch = pitchRate;
        break;
    case 'brass_thumb':
        theBeat.brassPitchVal = value;
        brassPitch = pitchRate;
        break;
    case 'synth_thumb':
        theBeat.synthPitchVal = value;
        synthPitch = pitchRate;
        break;
    case 'swing_thumb':
        theBeat.swingFactor = value;
        break; 
    }
}


function handleButtonMouseDown(event) {
    var notes = theBeat.rhythm1;
    
    var instrumentIndex;
    var rhythmIndex;

    var elId = event.target.id;
    rhythmIndex = elId.substr(elId.indexOf('_') + 1, 2);
    instrumentIndex = instruments.indexOf(elId.substr(0, elId.indexOf('_')));
        
    switch (instrumentIndex) {
        case 0: notes = theBeat.rhythm1; break;
        case 1: notes = theBeat.rhythm2; break;
        case 2: notes = theBeat.rhythm3; break;
        case 3: notes = theBeat.rhythm4; break;
        case 4: notes = theBeat.rhythm5; break;
    }

    notes[rhythmIndex] = (notes[rhythmIndex] + 1) % 2;

    if (instrumentIndex == currentlyActiveInstrument)
        showCorrectNote( rhythmIndex, notes[rhythmIndex] );

    drawNote(notes[rhythmIndex], rhythmIndex, instrumentIndex);

    var note = notes[rhythmIndex];
    
    if (note) {
        switch(instrumentIndex) {
        case 0:  // Kick
          playNote(currentKit.kickBuffer, false, 0,0,-2, 0.5 * theBeat.effectMix, track_volume[0] * 1.0, kickPitch, 0);
          break;

        case 1:  // Snare
          playNote(currentKit.snareBuffer, false, 0,0,-2, theBeat.effectMix, track_volume[1] * 0.6, snarePitch, 0);
          break;

        case 2:  // Hihat
          playNote(currentKit.hihatBuffer, true, 0.5*rhythmIndex - 4, 0, -1.0, theBeat.effectMix, track_volume[2] * 0.7, hihatPitch, 0);
          break;

        case 3:  // Tom 1   
          playNote(currentKit.brass, false, 0,0,-2, theBeat.effectMix, track_volume[3] * 0.6, brassPitch, 0);
          break;

        case 4:  // Tom 2   
          playNote(currentKit.synth, false, 0,0,-2, theBeat.effectMix, track_volume[4] * 0.6, synthPitch, 0);
          break;
        }
    }
}

// function handleKitComboMouseDown(event) {
//     document.getElementById('kitcombo').classList.toggle('active');
// }

// function handleKitMouseDown(event) {
//     var index = kitNamePretty.indexOf(event.target.innerHTML);
//     theBeat.kitIndex = index;
//     currentKit = kits[index];
//     document.getElementById('kitname').innerHTML = kitNamePretty[index];
// }

function handleBodyMouseDown(event) {
    var elKitcombo = document.getElementById('kitcombo');
    var elEffectcombo = document.getElementById('effectcombo');

    if (elKitcombo.classList.contains('active') && !isDescendantOfId(event.target, 'kitcombo_container')) {
        elKitcombo.classList.remove('active');
        if (!isDescendantOfId(event.target, 'effectcombo_container')) {
            event.stopPropagation();
        }
    }
    
    if (elEffectcombo.classList.contains('active') && !isDescendantOfId(event.target, 'effectcombo')) {
        elEffectcombo.classList.remove('active');
        if (!isDescendantOfId(event.target, 'kitcombo_container')) {
            event.stopPropagation();
        }
    }    
}

function isDescendantOfId(el, id) {
    if (el.parentElement) {
        if (el.parentElement.id == id) {
            return true;
        } else {
            return isDescendantOfId(el.parentElement, id);
        }
    } else {
        return false;
    }
}

function handleEffectComboMouseDown(event) {
    if (event.target.id != 'effectlist') {
        document.getElementById('effectcombo').classList.toggle('active');
    }
}

function handleEffectMouseDown(event) {
    for (var i = 0; i < impulseResponseInfoList.length; ++i) {
        if (impulseResponseInfoList[i].name == event.target.innerHTML) {

            // Hack - if effect is turned all the way down - turn up effect slider.
            // ... since they just explicitly chose an effect from the list.
            if (theBeat.effectMix == 0)
                theBeat.effectMix = 0.5;

            setEffect(i);
            break;
        }
    }
}

function setEffect(index) {
    if (index > 0 && !impulseResponseList[index].isLoaded()) {
        alert('Sorry, this effect is still loading.  Try again in a few seconds :)');
        return;
    }

    theBeat.effectIndex = index;
    effectDryMix = impulseResponseInfoList[index].dryMix;
    effectWetMix = impulseResponseInfoList[index].wetMix;            
    convolver.buffer = impulseResponseList[index].buffer;

  // Hack - if the effect is meant to be entirely wet (not unprocessed signal)
  // then put the effect level all the way up.
    if (effectDryMix == 0)
        theBeat.effectMix = 1;

    setEffectLevel(theBeat);
    updateControls();

}

function setEffectLevel() {        
    // Factor in both the preset's effect level and the blending level (effectWetMix) stored in the effect itself.
    effectLevelNode.gain.value = theBeat.effectMix * effectWetMix;
}


function handleDemoMouseDown(event) {
    var loaded = false;
    
    switch(event.target.id) {
        case 'demo1':
            loaded = loadBeat(beatDemo[0]);    
            break;
        case 'demo2':
            loaded = loadBeat(beatDemo[1]);    
            break;
        case 'demo3':
            loaded = loadBeat(beatDemo[2]);    
            break;
        case 'demo4':
            loaded = loadBeat(beatDemo[3]);    
            break;
        case 'demo5':
            loaded = loadBeat(beatDemo[4]);    
            break;
    }
    
    if (loaded)
        handlePlay();
}

function handlePlay(event) {
    if (startAlertAlive) {
        removeStartAlert()
    }

    noteTime = 0.0;
    startTime = context.currentTime + 0.005;
    schedule();
    timerWorker.postMessage("start");

    document.getElementById('play').classList.add('playing');
    document.getElementById('stop').classList.add('playing');
    if (midiOut) {
        // turn off the play button
        midiOut.send( [0x80, 3, 32] );
        // light up the stop button
        midiOut.send( [0x90, 7, 1] );        
    }
}

function removeStartAlert() {
    document.getElementById('startAlert').classList.add('fadeOut');

}

function handleStop(event) {
    timerWorker.postMessage("stop");

    // var elOld = document.getElementById('LED_' + (rhythmIndex + 14) % 16);
    // elOld.src = 'images/LED_off.png';

    hideBeat( (rhythmIndex + 14) % 16 );

    rhythmIndex = 0;

    document.getElementById('play').classList.remove('playing');
    document.getElementById('stop').classList.remove('playing');
    if (midiOut) {
        // light up the play button
        midiOut.send( [0x90, 3, 32] );
        // turn off the stop button
        midiOut.send( [0x80, 7, 1] );
    }
}


function toggleSaveContainer() {
    document.getElementById('pad').classList.toggle('active');
    document.getElementById('params').classList.toggle('active');
    document.getElementById('tools').classList.toggle('active');
    document.getElementById('save_container').classList.toggle('active');
}

function toggleLoadContainer() {
    document.getElementById('pad').classList.toggle('active');
    document.getElementById('params').classList.toggle('active');
    document.getElementById('tools').classList.toggle('active');
    document.getElementById('load_container').classList.toggle('active');
}

function loadBeat(beat) {
    // Check that assets are loaded.
    if (beat != beatReset && !beat.isLoaded())
        return false;

    handleStop();

    theBeat = cloneBeat(beat);
    // currentKit = kits[theBeat.kitIndex];
    setEffect(theBeat.effectIndex);

    // apply values from sliders
    sliderSetValue('effect_thumb', theBeat.effectMix);
    sliderSetValue('kick_thumb', theBeat.kickPitchVal);
    sliderSetValue('snare_thumb', theBeat.snarePitchVal);
    sliderSetValue('hihat_thumb', theBeat.hihatPitchVal);
    sliderSetValue('brass_thumb', theBeat.brassPitchVal);
    sliderSetValue('synth_thumb', theBeat.synthPitchVal);

    sliderSetValue('swing_thumb', theBeat.swingFactor);

    updateControls();
    setActiveInstrument(0);

    return true;
}

function updateControls() {
    for (i = 0; i < loopLength; ++i) {
        for (j = 0; j < kNumInstruments; j++) {
            switch (j) {
                case 0: notes = theBeat.rhythm1; break;
                case 1: notes = theBeat.rhythm2; break;
                case 2: notes = theBeat.rhythm3; break;
                case 3: notes = theBeat.rhythm4; break;
                case 4: notes = theBeat.rhythm5; break;
            }

            drawNote(notes[i], i, j);
        }
    }
}


function drawNote(draw, xindex, yindex) {    
    const tk_idx = yindex

    var cur_beet = document.getElementById(instruments[yindex] + '_' + xindex);
    switch (draw) {
        case 0: cur_beet.classList.add("beet-off"); break;
        case 1: drawActiveNote(cur_beet, tk_idx); break;
    }
}

const min_beet_size = 30
function drawActiveNote(beet, tk_idx) {
    let raw_size = track_volume[tk_idx] 
    let size_remap = 20

    if (raw_size != 0){
        size_remap = min_beet_size + raw_size*(100-min_beet_size) // remap 0-1 to 20-100
    }
    let size = size_remap+"%"

    beet.classList.remove("beet-off")
    beet.style.setProperty('--beetSize', size)
}

function drawPlayhead(xindex) {
    var lastIndex = (xindex + 15) % 16;

    // var elNew = document.getElementById('LED_' + xindex);
    // var elOld = document.getElementById('LED_' + lastIndex);
    
    // elNew.src = 'images/LED_on.png';
    // elOld.src = 'images/LED_off.png';

    // hideBeat( lastIndex );
    // showBeat( xindex );

    var rake = document.getElementById('rakeContainer');
    rake.style.setProperty('--leftPos', lastIndex)

}

function filterFrequencyFromCutoff( cutoff ) {
    var nyquist = 0.5 * context.sampleRate;

    // spreads over a ~ten-octave range, from 20Hz - 20kHz.
    var filterFrequency = Math.pow(2, (11 * cutoff)) * 40;

    if (filterFrequency > nyquist)
        filterFrequency = nyquist;
    return filterFrequency;
}

function setFilterCutoff( cutoff ) {
    if (filterNode)
        filterNode.frequency.value = filterFrequencyFromCutoff( cutoff );
}

function setFilterQ( Q ) {
    if (filterNode)
        filterNode.Q.value = Q;
}




// NEW STUFF BY ME

function handleRadio(track, param, idx) { // kick, complexity, 4, idx is param idx not tk_idx
    // update frontend
    let maxIdx = 2;
    if (param == "complexity") {
        maxIdx = 4;
    }
    for (let i=1; i <= maxIdx; i++) {
        document.getElementById(track+"-"+param+"-"+i).classList.remove("activeRadio");
    }
    document.getElementById(track+"-"+param+"-"+idx).classList.add("activeRadio");
    
    // do something with backend
    if (param == "sampletype") {
        handleSampletypeChange(track,idx)
    } 
    else if (param == "complexity") {
        handleComplexityChange(track,idx)
    }
}

function handleSampletypeChange(track,val_input) {
    // UPDATES GLOBAL track_organic ARRAY, WITH BOOL VALUE FOR EACH TRACK
    let val = false
    if (val_input == 2) { // 2 = organic/true, otherwise keep as false for generic
        val = true
    }
    let tk_idx = track2idx[track];
    if (track_organic[tk_idx] != val){
        track_organic[tk_idx] = val
        updateCurrentKit(track, null, val)
    }
    // else dont do anything, such as updating the kit to the same sample
}


function toggleDropdown(track) {
    document.getElementById("dropdownMenu_"+track).classList.toggle("show");
}

// Close dropdown when clicking outside
window.onclick = function(event) {
    // if (!event.target.matches('.dropdown-button')) {
    //     let dropdown = document.getElementById("dropdownMenu");
    //     if (dropdown.classList.contains('show')) {
    //         dropdown.classList.remove('show');
    //     }

    // }



    let dropdown;
    
    if (!event.target.matches('.dropdown-button')) {
        dropdown = document.getElementById("dropdownMenu_kick");
        if (dropdown.classList.contains('show')) {dropdown.classList.remove('show');}
        dropdown = document.getElementById("dropdownMenu_snare");
        if (dropdown.classList.contains('show')) {dropdown.classList.remove('show');}
        dropdown = document.getElementById("dropdownMenu_hihat");
        if (dropdown.classList.contains('show')) {dropdown.classList.remove('show');}
        dropdown = document.getElementById("dropdownMenu_brass");
        if (dropdown.classList.contains('show')) {dropdown.classList.remove('show');}
        dropdown = document.getElementById("dropdownMenu_synth");
        if (dropdown.classList.contains('show')) {dropdown.classList.remove('show');}
    }
}

const styleDictPretty = {
    'boombap':"Boom-Bap",
    'westcoast':"West Coast",
    'trap':"Trap",
    'neptunes':"Neptunes",
}
function handleStyleSelection(track, stylecode) {
    let dropdown = document.getElementById("dropdownMenu");
    let stylePretty = styleDictPretty[stylecode];
    document.getElementById(track+"_ddlabel").innerText = stylePretty;

    let tk_idx = track2idx[track];
    track_style[tk_idx] = stylecode
    let cur_complexity = track_complexity[tk_idx]

    updateCurrentKit(track, stylecode)
    updatePattern(track,stylecode,cur_complexity)
}

function handleSlider(track, type) {
    //type is optional to differenitate for master: volume / tempo
    if (!type) {
        type = 'volume'
    } 
    let slider = document.getElementById(type+"_"+track);
    let label = document.getElementById(track+"-"+type+"label");
    label.textContent = slider.value;

    if (type=="tempo"){
        handleTempoChange(slider.value)
    } else if (type=="volume" && track=="master"){
        handleMasterVolChange(slider.value)
    } else if (type=="volume") {
        handleTrackVolumeChange(track, slider.value)
    }
}


function handleTempoChange(val) {
    theBeat.tempo = Math.max(kMinTempo, Math.min(kMaxTempo, val));
}

function handleMasterVolChange(val) {
    masterGainNode.gain.value = (val / 100).toFixed(2); // reduce overall volume to avoid clipping
}

const track2idx = {
    "kick":0,
    "snare":1,
    "hihat":2,
    "brass":3,
    "synth":4,
}
function handleTrackVolumeChange(track, val) {
    val = parseInt(val)

    let val_scaled = (val / 100); // reduce overall volume to avoid clipping
    let tk_idx = track2idx[track];
    track_volume[tk_idx] = val_scaled;

    redrawRow(tk_idx) // tk_idx
}


function handleMuteBtn(track) {
    let img = document.getElementById(track+"_mute");
    let state = img.src.includes("img/btn_trackunmuted.png") ? "muted" : "unmuted";

    img.src = "img/btn_track"+state+".png";

    let tk_idx = track2idx[track]
    let cb = document.getElementById("cb_"+track);
    if (state == "muted") {
        cb.style.setProperty('--trackColor', 'var(--c-cream2)')
        instrumentActive[tk_idx] = false
    } else {
        cb.style.setProperty('--trackColor', 'var(--trackColor-'+track+')') 
        instrumentActive[tk_idx] = true
    }
}



function updatePattern(track,stylecode,complexity) {
    //// window.PATTERNLIB[track][stylecode][complexity]
    //// window.PATTERNLIB["snare"]["trap"][3]

    let tk_idx = track2idx[track]

    // let new_rhythm = [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] //leftoff
    let rhythm_raw = window.PATTERNLIB[track][stylecode][complexity - 1]
    let new_rhythm = window.parseRawRhythm(rhythm_raw)
    
    switch (tk_idx) {
        case 0: theBeat.rhythm1 = new_rhythm; break;
        case 1: theBeat.rhythm2 = new_rhythm; break;
        case 2: theBeat.rhythm3 = new_rhythm; break;
        case 3: theBeat.rhythm4 = new_rhythm; break;
        case 4: theBeat.rhythm5 = new_rhythm; break;
    }
    redrawRow(tk_idx) // tk_idx
}

function handleComplexityChange(track, val) {
    let tk_idx = track2idx[track]
    track_complexity[tk_idx] = val
    
    let cur_style = track_style[tk_idx]

    updatePattern(track, cur_style, val)
}


function redrawRow(track_idx) {
    for (i = 0; i < loopLength; ++i) {
            switch (track_idx) {
                case 0: notes = theBeat.rhythm1; break;
                case 1: notes = theBeat.rhythm2; break;
                case 2: notes = theBeat.rhythm3; break;
                case 3: notes = theBeat.rhythm4; break;
                case 4: notes = theBeat.rhythm5; break;
            }
            drawNote(notes[i], i, track_idx);
    }
}

// function cloneBeat2(source) {
//     var beat = new Object();
    
//     beat.kitIndex = source.kitIndex;
//     beat.effectIndex = source.effectIndex;
//     beat.tempo = source.tempo;
//     beat.swingFactor = source.swingFactor;
//     beat.effectMix = source.effectMix;
//     beat.kickPitchVal = source.kickPitchVal;
//     beat.snarePitchVal = source.snarePitchVal;
//     beat.hihatPitchVal = source.hihatPitchVal;
//     beat.brassPitchVal = source.brassPitchVal;
//     beat.synthPitchVal = source.synthPitchVal;
//     beat.rhythm1 = source.rhythm1.slice(0);        // slice(0) is an easy way to copy the full array
//     beat.rhythm2 = source.rhythm2.slice(0);
//     beat.rhythm3 = source.rhythm3.slice(0);
//     beat.rhythm4 = source.rhythm4.slice(0);
//     beat.rhythm5 = source.rhythm5.slice(0);
    
//     return beat;
// }

const style2idx = {
    'boombap':0,
    'westcoast':1,
    'trap':2,
    'neptunes':3,
    'organic':4,
}

function updateCurrentKit(track, stylecode, organic) {
    if (!stylecode) {
        let tk_idx = track2idx[track];
        stylecode = track_style[tk_idx]
    }

    if (!organic) {
        let tk_idx = track2idx[track];
        organic = track_organic[tk_idx]
    }
    currentKit = customKit(track, stylecode, organic)
}

function customKit(track,style,organic) {

    let custom_kit = currentKit;
    let replace_name = track+"Buffer"

    let replaceBuffer;
    if (organic){
        replaceBuffer =  instSamples[style2idx["organic"]][replace_name]
    } else {
        replaceBuffer =  instSamples[style2idx[style]][replace_name]
    }

    custom_kit[replace_name] = replaceBuffer;

    return custom_kit
}




// SAMPLE LIBRARY != KIT REMAKE

function InstrumentSamples(name) {
    this.name = name;

    this.pathName = function() {
        var pathName = "samples/" + this.name + "/";
        return pathName;
    };

    this.kickBuffer = 0;
    this.snareBuffer = 0;
    this.hihatBuffer = 0;
    this.brassBuffer = 0;
    this.hihatBuffer = 0;

    this.instrumentCount = kNumInstruments;
    this.instrumentLoadCount = 0;
    
    this.startedLoading = false;
    this.isLoaded = false;
    
    this.demoIndex = -1;
}

InstrumentSamples.prototype.setDemoIndex = function(index) {
    this.demoIndex = index;
}

InstrumentSamples.prototype.load = function() {
    if (this.startedLoading)
        return;
        
    this.startedLoading = true;
        
    var pathName = this.pathName();

    var kickPath = pathName + "kick.wav";
    var snarePath = pathName + "snare.wav";
    var hihatPath = pathName + "hihat.wav";
    var brassPath = pathName + "brass.wav";
    var synthPath = pathName + "synth.wav";

    this.loadSample(0, kickPath, false);
    this.loadSample(1, snarePath, false);
    this.loadSample(2, hihatPath, false);
    this.loadSample(3, brassPath, false);
    this.loadSample(4, synthPath, false);
}

InstrumentSamples.prototype.loadSample = function(sampleID, url, mixToMono) {
    // Load asynchronously

    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    var kit = this;

    request.onload = function() {
        context.decodeAudioData(request.response, decodedFunctions[sampleID].bind(kit));

        kit.instrumentLoadCount++;
        if (kit.instrumentLoadCount == kit.instrumentCount) {
            kit.isLoaded = true;

            if (kit.demoIndex != -1) {
                beatDemo[kit.demoIndex].setKitLoaded();
            }
        }
    }

    request.send();
}


function pageRedirect(page) {
    window.location.href = page; 
}