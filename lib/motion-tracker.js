var fx = require('./glfx')
  , Emitter = require('emitter')
  , settings = require('./settings');

module.exports = MotionTracker;

function MotionTracker(){

  var tracker = this;

  Emitter(tracker)

  var isInitiated = false;

  var INPUT_SCALE = 2;
  var INPUT_WIDTH = 320/INPUT_SCALE;
  var INPUT_HEIGHT = 240/INPUT_SCALE;
  var MIN_BLOB_SIDE = 10;
  var VIDEO_FPS = 24;

  var is_webkit = false;
  var videoInput, videoInputCanvas,videoTextureCanvas;
  var fxStacks = [];
  var inputSplitList = [];
  var bufferCanvasStack = [];
  var blobRectCanvas;
  var floodfillDebugCanvas;

  var motionFadeCanvas;
  var motionResultBuffer = []; 
  var finalOutputCanvas;
  var bFirstTime = true;
  var textures = [];

  var boundsBoxes = [];
  var markerToX = 0;
  var markerToY = 0;
  var markerCurrentX = 0;
  var markerCurrentY = 0;
  var colorMarkerX = 0;
  var colorMarkerY = 0;
  var lastFrameNumber = 0;
  var smoothedMarkersListX = new Array();
  //var smoothedMarkersListY = new Array();
  var selectPaddleOpen = false;
    
  var interpolatedX = 0;

  tracker.init = function(){
  
    if( isInitiated ) return;

    isInitiated = true;

    var colors = localStorage.getItem('paddleColor');

    if( colors ) {
      settings.data.trackingColor = colors.split(":");

      $("#colorSelectArea").css("border-color", "rgb("+settings.data.trackingColor[0]+","+settings.data.trackingColor[1]+","+settings.data.trackingColor[2]+")");
    }

    if (navigator.getUserMedia) {
        // opera users (hopefully everyone else at some point)
        navigator.getUserMedia({video: true, audio: true}, tracker.onSuccess, tracker.onError);
    }
    else if (navigator.webkitGetUserMedia) {
        // webkit users
        is_webkit = true;

        navigator.webkitGetUserMedia({video: true, audio: false}, tracker.onSuccess, tracker.onError);
    }
    else {
        // moms, dads, grandmas, and grandpas
        alert("sorry, no webcam support.")
    }
    
  }

  tracker.onSuccess = function(stream) {

    $("#activateCamHolder").fadeOut();

    var source;

    tracker.setupElements();

    videoInput.addEventListener('loadedmetadata', tracker.onVideoFeedReady);

    videoInput.width = INPUT_WIDTH*INPUT_SCALE;
    videoInput.height = INPUT_HEIGHT*INPUT_SCALE;
    videoInput.autoplay = true; // you can set this in your markup instead

    if (!is_webkit) {
        source = stream;
    }
    else {
        source = window.webkitURL.createObjectURL(stream);
    }

    tracker.emit('userMedia',stream,source);

    window.URL = window.URL || window.webkitURL;
    videoInput.src = source;
    
  }

  tracker.onError = function() {
    $("#activateCamHolder").fadeOut();
    // null = no media
    tracker.emit('userMedia');
  }

  tracker.setupElements = function(){

    videoInput = document.getElementById('videoInput');
    //videoInput.addEventListener("mousedown", tracker.onCanvasClicked);

    $("body").keypress(function(event) {
      if ( event.which == 32 ) {
        
        selectPaddleOpen = true;

        $("#colorSelectContainer").show();

        colorMarkerX = INPUT_WIDTH-Math.floor(($("#colorSelectArea").position().left+$("#colorSelectCenter").position().left)/$("#colorSelectContainer").width()*INPUT_WIDTH);
        colorMarkerY = Math.floor(($("#colorSelectArea").position().top+$("#colorSelectCenter").position().top)/$("#colorSelectContainer").width()*INPUT_HEIGHT);

         event.preventDefault();
       }
    });

    $("body").keyup(function(event) {
      if ( event.which == 32 ) {
        
        $("#colorSelectContainer").hide();

         selectPaddleOpen = false;

       // var relPos = eventToCoords(videoInput,evt);
       
        var c = bufferCanvasStack[1].getContext("2d").getImageData( colorMarkerX, colorMarkerY, 1, 1).data;
    
        settings.data.trackingColor = [c[0],c[1],c[2]];
        tracker.emit('colorUpdate',c[0],c[1],c[2]);

        localStorage.setItem("paddleColor", c[0] + ":" + c[1] + ":" + c[2]);

        $("#marker").css("background-color", "rgb("+c[0]+","+c[1]+","+c[2]+")");

         event.preventDefault();
       }
    });

    videoInputCanvas = document.createElement('canvas');//document.getElementById('videoInputCanvas');
    videoInputCanvas.width = INPUT_WIDTH;
    videoInputCanvas.height = INPUT_HEIGHT;
   
    //fx stacks
    var fxCanvas = fx.canvas();
    //$("#monitorFinalContainer").prepend(fxCanvas);
    fxStacks[0] = fxCanvas;

    blobRectCanvas = document.createElement('canvas');
    blobRectCanvas.width = INPUT_WIDTH;
    blobRectCanvas.height = INPUT_HEIGHT;
    $("#monitorFinalBlobs").prepend(blobRectCanvas);

    for( var i=0;i<4;i++) {

        var bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = INPUT_WIDTH;
        bufferCanvas.height = INPUT_HEIGHT;
        bufferCanvasStack[i] = bufferCanvas;

        //fill with video
        bufferCanvas.getContext("2d").drawImage(videoInput, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    }

  }

  tracker.onVideoFeedReady = function(){

    //create textures
    textures["currentFrame"] = fxStacks[0].texture(INPUT_WIDTH,INPUT_HEIGHT);
    textures["lastFrame"] = fxStacks[0].texture(INPUT_WIDTH,INPUT_HEIGHT);

    tracker.update();

    videoTextureCanvas = document.createElement('canvas');//document.getElementById('videoInputCanvas');
    videoTextureCanvas.width = videoInput.videoWidth
    videoTextureCanvas.height = videoInput.videoHeight
  }

  tracker.update = function() {

    if( settings.data.inputType == "motion" && !tracker.isInitiated) {
      tracker.init();
    }

    if( videoInput ){

      if( selectPaddleOpen ) {
        var c = bufferCanvasStack[1].getContext("2d").getImageData( colorMarkerX, colorMarkerY, 1, 1).data;
        $("#colorSelectArea").css("border-color", "rgb("+c[0]+","+c[1]+","+c[2]+")");
      }
        
      var currentFrameNumber = Math.floor(videoInput.currentTime * VIDEO_FPS);
      if (currentFrameNumber > lastFrameNumber) {
        tracker.doTracking();
        lastFrameNumber = currentFrameNumber;
      }

      interpolatedX += ( markerCurrentX-interpolatedX)*0.1

      tracker.emit('trackerUpdate',interpolatedX,0);
    }
    
  }

  tracker.doTracking = function(){

     //get data from webcam, save it to first index in buffer 
    var selectedBufferCanvas = bufferCanvasStack.splice(bufferCanvasStack.length-1,1)[0]; 
    selectedBufferCanvas.getContext("2d").drawImage(videoInput, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    bufferCanvasStack.splice(1,0,selectedBufferCanvas);

    videoInputCanvas.getContext("2d").drawImage(videoInput, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    //videoTextureCanvas.getContext("2d").drawImage(videoInput, 0, 0, videoTextureCanvas.width, videoTextureCanvas.height);


    tracker.emit('videoTexture',videoInputCanvas);

    textures["currentFrame"].loadContentsOf(videoInputCanvas);
    textures["lastFrame"].loadContentsOf(bufferCanvasStack[bufferCanvasStack.length-1]);
    //fx stack 1

    fxStacks[0].draw(textures["lastFrame"]);
    
    fxStacks[0].motionBlob(
      textures["currentFrame"], 
      20-settings.data.motionBlur,
      settings.data.motionThreshold,
      20-settings.data.trackingColorPreBlur,
      settings.data.trackingColor[0]/255,settings.data.trackingColor[1]/255,settings.data.trackingColor[2]/255, 
      settings.data.trackingColorThreshold,
      settings.data.useMotionTracking?1:0,
      INPUT_WIDTH, 
      INPUT_HEIGHT
    )
    
    fxStacks[0].update();

    tracker.blobDetect();

    while( smoothedMarkersListX.length > settings.data.pointSmoothing) {
      smoothedMarkersListX.pop();
    }

    while( smoothedMarkersListX.length < settings.data.pointSmoothing) {
      smoothedMarkersListX.unshift(0);
    }


    smoothedMarkersListX.unshift(markerToX);
    //smoothedMarkersListY.unshift(markerToY);
    smoothedMarkersListX.pop();
    //smoothedMarkersListY.pop();

    markerCurrentX = tracker.median(smoothedMarkersListX.concat())
    markerCurrentY = 0//tracker.median(smoothedMarkersListY)
    
   
  }

  tracker.median = function(values) {

    values.sort( function(a,b) {return a - b;} );

    var half = Math.floor(values.length/2);

    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
  }

  tracker.blobDetect = function() {
    
    var width = INPUT_WIDTH;
    var height = INPUT_HEIGHT;
    
    var motionByteArray = fxStacks[0].getPixelArray();

    var len = motionByteArray.length;

    var mainBB = {
      minx:INPUT_WIDTH,
      maxx:0,
      miny:INPUT_HEIGHT,
      maxy:0,
    }


    var colorBB = {
      minx:INPUT_WIDTH,
      maxx:0,
      miny:INPUT_HEIGHT,
      maxy:0,
    }

    var currentX;
    var currentY;

    var bUpdate = false;

    var mainPixelsFound = 0;
    var colorPixelsFound = 0;
    //fill blob detection image data

    var searchColorChannel = settings.data.useMotionTracking?2:0;

    for(var i=0;i<len;i+=4)
    {
      currentX = parseInt((i/4)%(INPUT_WIDTH));
      currentY = parseInt((i/4)/(INPUT_WIDTH)) 

      if( (motionByteArray[i+searchColorChannel] ) > 0 ) {
        if( currentX < mainBB.minx ) mainBB.minx = currentX;
        if( currentX > mainBB.maxx ) mainBB.maxx = currentX;
        if( currentY < mainBB.miny ) mainBB.miny = currentY;
        if( currentY > mainBB.maxy ) mainBB.maxy = currentY;

        mainPixelsFound++

      }  

      if( (motionByteArray[i] ) > 0 ) {
        if( currentX < colorBB.minx ) colorBB.minx = currentX;
        if( currentX > colorBB.maxx ) colorBB.maxx = currentX;
        if( currentY < colorBB.miny ) colorBB.miny = currentY;
        if( currentY > colorBB.maxy ) colorBB.maxy = currentY;

        colorPixelsFound++
      }
    }

    if( settings.data.trackingColorAutoThreshold) {
      if( colorPixelsFound < 80 ) {
        settings.data.trackingColorThreshold += 0.01
      }
      else if( colorBB.maxx - colorBB.minx > 30 ) {
        settings.data.trackingColorThreshold -= 0.01
      }

      if( settings.data.trackingColorThreshold > 0.6) settings.data.trackingColorThreshold = 0.6
      else if( settings.data.trackingColorThreshold < 0.1) settings.data.trackingColorThreshold = 0.1
    }

    if( mainPixelsFound > 10 ) {

      var localX = mainBB.minx + (mainBB.maxx - mainBB.minx)/2
      var localY = mainBB.miny + (mainBB.maxy - mainBB.miny)/2
      
      blobRectCanvas.getContext("2d").clearRect(0,0,INPUT_WIDTH,INPUT_HEIGHT);
      blobRectCanvas.getContext("2d").strokeStyle = "#ff0000";
      blobRectCanvas.getContext("2d").strokeRect(mainBB.minx,mainBB.miny,mainBB.maxx-mainBB.minx,mainBB.maxy-mainBB.miny);

      markerToX = localX / INPUT_WIDTH//*2 - 0.5;
      markerToY = localY / INPUT_HEIGHT;
    }
  }

  return tracker;
}


function eventToCoords(element,event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = element;

  do {
    totalOffsetX += currentElement.offsetLeft;
    totalOffsetY += currentElement.offsetTop;
  }
  while (currentElement = currentElement.offsetParent)

  canvasX = event.pageX - totalOffsetX;
  canvasY = event.pageY - totalOffsetY;

  // Fix for variable canvas width
  canvasX = Math.round( canvasX * (element.width / element.offsetWidth) );
  canvasY = Math.round( canvasY * (element.height / element.offsetHeight) );

  return {x:canvasX, y:canvasY}
}