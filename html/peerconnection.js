var PeerConnection = (window.RTCPeerConnection || window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
var URL = (window.URL || window.webkitURL || window.mozURL || window.msURL );
var getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
var nativeRTCIceCandidate = (window.RTCIceCandidate || window.mozRTCIceCandidate);
var nativeRTCSessionDescription = (window.RTCSessionDescription || window.mozRTCSessionDescription);
var localstream = null;
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

var iceServer = {
  iceServers: [
      {url: "stun:23.21.150.121"},
      {url: "stun:stun.l.google.com:19302"},
	  {url: "stun:124.124.124.2"},  //firefox
      {url: "turn:numb.viagenie.ca", credential: "xxxx", username: "xxx"}
  ]
};
var localPeerConnection = null;
var remotePeerConnection = null;
var localDataChannel;
var remoteDataChannel;
var activeDataChannel;  

var is_request_side = 2;
var dataChannelConnected = 0;

var options = {
  optional: [
      {dtlssrtpkeyagreement: false},  
      {rtpdatachannels: true}
  ]
};

var dataChannelOptions = null;

function openLocalCamera() {
  try {
    getUserMedia({audio:true, video:true}, gotLocalStream, function() {});
  } catch (e) {
    trace("error: " + e.description);
  }
}

attachMediaStream = function(element, stream) {
  if (typeof element.srcObject !== 'undefined') {
    element.srcObject = stream;
  } else if (typeof element.mozSrcObject !== 'undefined') {
    element.mozSrcObject = stream;
  } else if (typeof element.src !== 'undefined') {
    element.src = URL.createObjectURL(stream);
  } else {
    console.log('Error attaching stream to element.');
  }
};  

function gotLocalStream(stream) {
  trace("Received local stream");
  localstream = stream;
  str = "<video id='vid1' muted autoplay></video>";
  addVideoLabel(str);
  attachMediaStream(vid1, stream);
} 

function gotRemoteStream(e) {
  str = "<video id='vid2' style='align:right' autoplay></video>";
  addVideoLabel(str);
  attachMediaStream(vid2, e.stream);
  trace("Received remote stream");
}

function start() {
  is_request_side = 1;   
  trace("Starting Call");
  localPeerConnection = new PeerConnection(iceServer, options);
  trace("Created PeerConnection object localPeerConnection.");
  try {
    localDataChannel = localPeerConnection.createDataChannel('localDataChannel',
        dataChannelOptions );
    trace('Created local data channel');
  } catch (e) {
    alert('Failed to create local data channel. ' +
        'You need Chrome 25 or later with --enable-data-channels flag');
    trace('Create local data channel failed with exception: ' + e.message);
  }
  localDataChannel.onopen = onDataChannelStateChange;
  localDataChannel.onclose = onDataChannelStateChange;
  localDataChannel.onerror  = onlocalChannelError;
  localDataChannel.onmessage   = onDataChannelMessage;
  
  localPeerConnection.addStream(localstream);
  localPeerConnection.onicecandidate = iceCallback;
  localPeerConnection.onaddstream = gotRemoteStream;
  trace("Adding Local Stream to PeerConnection");

  localPeerConnection.createOffer(gotOfferDescription, onCreateSessionDescriptionError);
}

function gotOfferDescription(desc) {
  localPeerConnection.setLocalDescription(desc, setLocalSdpSuccessCb, setLocalSdpFailureCb);
  sendSignal(JSON.stringify(desc))
  trace("Send offer: \n" + desc.sdp);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function gotAnswerDescription(desc) {
  remotePeerConnection.setLocalDescription(desc, setLocalSdpSuccessCb, setLocalSdpFailureCb);
  sendSignal(JSON.stringify(desc));
  trace("Send answer\n" + desc.sdp);
}

function iceCallback(event) {
  if (event.candidate) {
    sendSignal(JSON.stringify(event.candidate)); 
    trace("Local ICE candidate: \n" + event.candidate.candidate);
  }
}

function onAddIceCandidateSuccess() {
  trace("AddIceCandidate success.");
}

function onAddIceCandidateError(error) {
  trace("Failed to add Ice Candidate: " + error.toString());
}

function setLocalSdpSuccessCb() {
  trace("SetLocalDescription Success.\n");
}

function setLocalSdpFailureCb(error) {
  trace("Failed to setLocalDescription: " + error.toString());
}

function setRemoteSdpSuccessCb() {
  trace("SetRemoteDescription Success.\n");
}

function setRemoteSdpFailureCb(error) {
  trace("Failed to setRemoteDescription: " + error.toString());
}

function onDataChannelStateChange() {
  var readyState;
  if(is_request_side == 1) {     
    readyState = localDataChannel.readyState;
  } else if(is_request_side == 2) {
    readyState = remoteDataChannel.readyState;
  }
  trace('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    dataChannelConnected = 1;
    document.getElementById("send").disabled = false;
  } else {
    dataChannelConnected = 0;
    document.getElementById("send").disabled = true;
  }
 
  if(dataChannelConnected === 1) {
    if(is_request_side === 1)
	  activeDataChannel = localDataChannel;
	else if(is_request_side === 2)
	  activeDataChannel = remoteDataChannel;
  }
}

function onlocalChannelError(error) {
  console.log("local Data Channel Error:", error);
}

function onRemoteChannelError(error) {
  console.log("Remote Data Channel Error:", error);
}

function getType(obj) {
  return (obj === null) ? "null" : typeof(obj);
}

function onDataChannelMessage(event) {
  var dataType = getType(event.data);
  if(dataType === "string") {
    try {
      var json = JSON.parse(event.data);
    } catch (e) {
      trace("error: " + e.description);
	  return;
    }
    if (json.messageType ===  "userChatMsg") {
      sortDataChannelMessage(json.messageContent);
    } else if(json.messageType === "mouseDownMsg") {
      if(getType(canvasWindow) !== "undefined"  && getType(canvasWindow) !== null) {
        var drawing = canvasWindow.drawing;
        drawing.recvMouseDown(json.message);
      }
    } else if(json.messageType === "mouseMoveMsg") {
	  if(getType(canvasWindow) !== "undefined"  && getType(canvasWindow) !== null) {
        var drawing = canvasWindow.drawing;
		drawing.recvMouseMove(json.message);
      }
	} else if(json.messageType === "mouseUpMsg") {
	   var drawing = canvasWindow.drawing;
       drawing.recvMouseUp(); 
    } else if(json.messageType === "recordActionsMsg") {
	   var drawing = canvasWindow.drawing;
       drawing.recvRecordActions(json.message); 
    } else if(json.messageType === "clearCanvasMsg") {
      if(canvasWindow !== null ) {
		var drawing = canvasWindow.drawing;
        drawing.clearCanvas(true);
      }  
    } else if (json.messageType === "openCanvasWin") {
      if(getType(canvasWindow) === "undefined"  || getType(canvasWindow) === null || canvasWindow.closed)
	    openLocalCanvas();
    } else if(json.messageType === "fileMetaDataMsg") {
	  var fileMetaData = json.fileMetaData;
	  if(fileMetaData.fileType.substr(0, 5) === "image" &&
	    getType(canvasWindow) !== "undefined" ) {
		if(canvasWindow.closed === false) {
		  fileTransConfirmMsg = JSON.stringify({
						            "messageType": "fileTransConfirmMsg",
								    "fileConfirm": "Allow"
								  });
		  activeDataChannel.send(fileTransConfirmMsg);	
		  recvFileEn = true; 
		  setRecvFileMetaData(fileMetaData);
          return;	
		}
	  }
	  var confirmMsg = '请确认接收来自远端的文件: ' + [fileMetaData.fileName, fileMetaData.fileSize, fileMetaData.fileType,
					    fileMetaData.fileLastModifiedDate].join(' ');
	  var result=confirm(confirmMsg);
	  var fileTransConfirmMsg;
	  if (result === true) {
		fileTransConfirmMsg = JSON.stringify({
						            "messageType": "fileTransConfirmMsg",
								    "fileConfirm": "Allow"
								  });
		activeDataChannel.send(fileTransConfirmMsg);	
	    recvFileEn = true;   
	  } else { 
	    recvFileEn = false; 
		fileTransConfirmMsg = JSON.stringify({
						            "messageType": "fileTransConfirmMsg",
								    "fileConfirm": "Refuse"
								  });
		activeDataChannel.send(fileTransConfirmMsg);				  
        return  	
	  }
	  setRecvFileMetaData(json.fileMetaData);
    } else if(json.messageType === "fileTransConfirmMsg") {
	    if(json.fileConfirm === "Allow") {
		  if(getType(fileToTransmit) === "undefined") {
		    alert("错误：fileToTransmit没有获得打开文件的对象实例");
			return;
		  }
	      SendFileBody(fileToTransmit);
	    } else if(json.fileConfirm === "Refuse") {
	      alert("对方拒绝了您的发送文件请求！");
	      return;
	    }
    }
  } else if(dataType === "object") {    
    if(recvFileEn === true) {
	  onReceiveFileChunk(event.data);
	} 
  }
}

function receiveChannelCallback(event) {
  trace('Receive Channel Callback');
  remoteDataChannel = event.channel;
  remoteDataChannel.binaryType = 'arraybuffer';
  remoteDataChannel.onmessage = onDataChannelMessage;
  remoteDataChannel.onopen = onDataChannelStateChange;
  remoteDataChannel.onclose = onDataChannelStateChange;
  remoteDataChannel.onerror  = onRemoteChannelError;
}