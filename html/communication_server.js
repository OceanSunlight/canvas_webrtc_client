var request = null;   
var hangingGet = null;  
var localName;
var server;
var my_id = -1;
var other_peers = {};
var message_counter = 0;
var canvasWindow;

var fileInput;
var downloadDiv;           
var recvFileMetaData;      
var sendProgress;
var receiveProgress;
var receiveBuffer = [];    
var recvFileDataSize = 0;  
var recvFileEn = false;    
var progressElms;          
var targetFile;
var fileToTransmit;        

function trace(txt) {
  var elem = document.getElementById("debug");
  elem.innerHTML += txt + "<br>";
}

function addVideoLabel(txt) {
  var vids = document.getElementById("videos");
  vids.innerHTML += txt;
}

function SetPreContent(txt) {
  var preVids = document.getElementById("videos");
  preVids.innerHTML = txt;
}

function handleServerNotification(data) {
  trace("Server notification: " + data);
  var parsed = data.split(',');
  if (parseInt(parsed[2]) != 0) {
    other_peers[parseInt(parsed[1])] = parsed[0];
	document.getElementById("peer_id").value = parseInt(parsed[1]);
  } else {
    document.getElementById("peer_id").value = "";
  }
}

function sortMessage(peer_id, data) {
  ++message_counter;
  var msg_id;
  var str = "Message from '" + other_peers[peer_id] + "'&nbsp;";
  str += "<span id='toggle_" + message_counter + "' onclick='toggleMe(this);' ";
  if(document.getElementById("chatmode").checked) {
    str += "style='cursor: pointer'>-</span><br>";
    str += "<blockquote id='msg_" + message_counter + "' style='display:block; color:blue; font-size:18px'>";
	msg_id = 'msg_' + message_counter;
  } else {
    str += "style='cursor: pointer'>+</span><br>";
    str += "<blockquote id='msg_" + message_counter + "' style='display:none; color:blue; font-size:18px'>";
  }
  str += data + "</blockquote>";
  trace(str);
  if(document.getElementById("chatmode").checked) {
    document.getElementById(msg_id).focus();
  }
}

function sortDataChannelMessage(data) {
  ++message_counter;
  var msg_id;
  var str = "Message from '" + "Webrtc DataChannel" + "'&nbsp;";
  str += "<span id='toggle_" + message_counter + "' onclick='toggleMe(this);' ";
  if(document.getElementById("chatmode").checked) {
    str += "style='cursor: pointer'>-</span><br>";
    str += "<blockquote id='msg_" + message_counter + "' style='display:block; color:blue; font-size:18px'>";
	msg_id = 'msg_' + message_counter;
  } else {
    str += "style='cursor: pointer'>+</span><br>";
    str += "<blockquote id='msg_" + message_counter + "' style='display:none; color:blue; font-size:18px'>";
  }
  str += data + "</blockquote>";
  trace(str);
  if(document.getElementById("chatmode").checked) {
    document.getElementById(msg_id).focus();
  }
}

function handlePeerMessage(peer_id, data) {
  sortMessage(peer_id, data);
  if (document.getElementById("loopback").checked) {
    if (data.search("offer") != -1) {
      if (data.search("fingerprint") != -1)
        data = data.replace("offer", "offer-loopback");
      else
        data = data.replace("offer", "answer");
    }
    sendToPeer(peer_id, data);
  } else {
    if (data.search("offer") != -1) { 
	  is_request_side = 2;
	  remotePeerConnection = new PeerConnection(iceServer, options);
	  remotePeerConnection.ondatachannel = receiveChannelCallback;
	 
	  remotePeerConnection.addStream(localstream);
	  remotePeerConnection.onicecandidate = iceCallback;
      remotePeerConnection.onaddstream = gotRemoteStream;
      trace("Adding Local Stream to peer connection");
	  trace("Received offer: \n" + (JSON.parse(data)).sdp);
	  remotePeerConnection.setRemoteDescription(new nativeRTCSessionDescription(JSON.parse(data)),
	                           setRemoteSdpSuccessCb, setRemoteSdpFailureCb );
	  remotePeerConnection.createAnswer(gotAnswerDescription, onCreateSessionDescriptionError,
                       sdpConstraints);
	} 
	if (data.search("answer") != -1) { 
	  trace("Received answer: \n" + (JSON.parse(data)).sdp);
	  localPeerConnection.setRemoteDescription(new nativeRTCSessionDescription(JSON.parse(data)),
	                          setRemoteSdpSuccessCb, setRemoteSdpFailureCb );
	} 
	if (data.search("candidate") != -1) { 
	  if(is_request_side == 1) { 
	    localPeerConnection.addIceCandidate(new nativeRTCIceCandidate(JSON.parse(data)),
                           onAddIceCandidateSuccess, onAddIceCandidateError);
      } else {
	    remotePeerConnection.addIceCandidate(new nativeRTCIceCandidate(JSON.parse(data)),
                           onAddIceCandidateSuccess, onAddIceCandidateError);
	  }
	}
	if(data.search("BYE") != -1) { 
	  passiveStop();
	}
  }
}

function GetIntHeader(r, name) {
  var val = r.getResponseHeader(name);
  return val != null && val.length ? parseInt(val) : -1;
}

function hangingGetCallback() {
  try {
    if (hangingGet.readyState != 4)
      return;
    if (hangingGet.status != 200) {
      trace("server error: " + hangingGet.statusText);
	  if(hangingGet.status != 0) 
        disconnect();
    } else {
      var peer_id = GetIntHeader(hangingGet, "Pragma");
      if (peer_id == my_id) {  
        handleServerNotification(hangingGet.responseText);
      } else { 
        handlePeerMessage(peer_id, hangingGet.responseText);
      }
    }

    if (hangingGet) {
      hangingGet.abort();
      hangingGet = null;
    }
   
    if (my_id != -1) 
      window.setTimeout(startHangingGet, 0); 
  } catch (e) {
    trace("Hanging get error: " + e.description);
  }
}

function startHangingGet() {
  try {
    hangingGet = new XMLHttpRequest();
    hangingGet.onreadystatechange = hangingGetCallback;
    hangingGet.ontimeout = onHangingGetTimeout;
    hangingGet.open("GET", server + "/wait?peer_id=" + my_id, true); 
    hangingGet.send(); 
  } catch (e) {
    trace("error" + e.description);
	stop();
  }
}

function onHangingGetTimeout() {
  trace("hanging get timeout. issuing again.");
  hangingGet.abort();
  hangingGet = null;
  if (my_id != -1)
    window.setTimeout(startHangingGet, 0);
}

function signInCallback() {
  try {
    if (request.readyState == 4) {
      if (request.status == 200) {
		openLocalCamera(); 
        var peers = request.responseText.split("\n");  
        my_id = parseInt(peers[0].split(',')[1]);     
		localName = localName + "_" + my_id;
		document.getElementById("local").value = localName;
        trace("My id: " + my_id);
        for (var i = 1; i < peers.length; ++i) {      
          if (peers[i].length > 0) {
            trace("Peer " + i + ": " + peers[i]);
            var parsed = peers[i].split(',');
            other_peers[parseInt(parsed[1])] = parsed[0];
			document.getElementById("peer_id").value = parseInt(parsed[1]);
          }
        }
        startHangingGet();
        request = null;
      }
    }
  } catch (e) {
    trace("error: " + e.description);
  }
}

function signIn() {
  try {
    request = new XMLHttpRequest();
    request.onreadystatechange = signInCallback;
	request.onerror = function(error) {
	  alert("Error occurred: " + "Server may not online, connection refused.");
	  document.getElementById("connect").disabled = false;
	  document.getElementById("disconnect").disabled = true;
      document.getElementById("send").disabled = true;
	}
    request.open("GET", server + "/sign_in?" + localName, true);
    request.send();
  } catch (e) {
    trace("error: " + e.description);
  }
}

function connect() {
  localName = document.getElementById("local").value.toLowerCase();
  server = document.getElementById("server").value.toLowerCase();
  if (localName.length == 0) {
    alert("I need a name please.");
    document.getElementById("local").focus();
  } else {
    document.getElementById("connect").disabled = true;
    document.getElementById("disconnect").disabled = false;
    document.getElementById("send").disabled = false;
    signIn();
  }
}

function disconnect() {
  sendBYE();
  if (request) {
    request.abort();
    request = null;
  }
  if (hangingGet) {
    hangingGet.abort();
    hangingGet = null;
  }
  if (my_id != -1) {
    request = new XMLHttpRequest();
    request.open("GET", server + "/sign_out?peer_id=" + my_id, false);
    request.send();
    request = null;
    my_id = -1;
  }
  document.getElementById("peer_id").value = "";
  document.getElementById('videos').innerHTML = '';
  document.getElementById("connect").disabled = false;
  document.getElementById("disconnect").disabled = true;
  document.getElementById("send").disabled = true;
}

window.onbeforeunload = disconnect;
window.onload = startOnLoad;

function startOnLoad() {
  fileInput = window.document.querySelector('input#fileInput');
  fileInput.addEventListener('change', clickSendFile, false);
  sendProgress = document.querySelector('progress#sendProgress');
  receiveProgress = document.querySelector('progress#receiveProgress');
  downloadDiv = document.querySelector('a#received');
  getLocalAddr();
  
  targetFile = document.getElementById("fileInput");
 
  targetFile.addEventListener("dragover", function(event) {
      event.preventDefault();
  }, false);
  
 
  targetFile.addEventListener("drop", dragSendFile, false);
  progressElms = document.getElementsByClassName("progress");
  fileProgressDisplay("Both", false);
}

function fileProgressDisplay(target, display) {
  if(target === "Both" && display === true) {
	for(var i = 0; i < progressElms.length; i++) {
      progressElms[i].style.display="inline";
    }
  } else if(target === "Both" && display === false) {  
    for(var i = 0; i < progressElms.length; i++) {
      progressElms[i].style.display="none";
    }
  } else if(target === "Send" && display === true) {  
    for(var i = 0; i < progressElms.length; i++) {
	  if(i === 0) 			
        progressElms[i].style.display="inline";
	  else if(i === 1)    
	    progressElms[i].style.display="none";
    }
  } else if(target === "Recv" && display === true) {  
    for(var i = 0; i < progressElms.length; i++) {
	  if(i === 0) 			
        progressElms[i].style.display="none";
	  else if(i === 1)     
	    progressElms[i].style.display="inline";
    }
  }
}

function $id(id) {
  return document.getElementById(id);
}
function outPut(msg) {
  var m = $id("debug");
  m.innerHTML = msg + " " + m.innerHTML;
}

function getLocalAddr() {
  var tmp = document.location.href;
  var url = tmp.substr(0, tmp.length - 1);
  document.getElementById("server").value = url;
}

function passiveStop() {
  trace("Other user ends the call or disconnect." + "\n\n");
  if(is_request_side == 1) {
    if(localPeerConnection != null) {
	  localDataChannel.close();
      localPeerConnection.close();
      localPeerConnection = null;
	}
  } else {
    if(remotePeerConnection != null) {
	  remoteDataChannel.close();
      remotePeerConnection.close();
      remotePeerConnection = null;
	}
  }
  str = "<video id='vid1' muted autoplay></video>";
  SetPreContent(str);
  attachMediaStream(vid1, localstream);
}

function stop() {
  trace("End the call" + "\n\n");
  if(is_request_side == 1) {
    if(localPeerConnection != null) {
	  localDataChannel.close();
	  localPeerConnection.close();
      localPeerConnection = null;
	}
  } else {
    if(remotePeerConnection != null) {
	  remoteDataChannel.close();
	  remotePeerConnection.close();
      remotePeerConnection = null;
	}
  }
  activeDataChannel = null;
  str = "<video id='vid1' muted autoplay></video>";
  SetPreContent(str);
  attachMediaStream(vid1, localstream);
  sendBYE();
}

function sendBYE() {
  var targetPeerId = parseInt(document.getElementById("peer_id").value);
  if (targetPeerId != 0) {
    sendToPeer(targetPeerId, "BYE");
  }
}

function sendToPeer(peer_id, data) {
  if (my_id == -1) {
    alert("Not connected");
    return;
  }
  if (peer_id == my_id) {
    alert("Can't send a message to oneself :)");
    return;
  }
  var r = new XMLHttpRequest();
  r.open("POST", server + "/message?peer_id=" + my_id + "&to=" + peer_id,
         false);
  r.setRequestHeader("Content-Type", "text/plain");
  r.send(data);
  r = null;
}

function send() {
  var text = document.getElementById("message").value;
  var peer_id = parseInt(document.getElementById("peer_id").value);
  if (!text.length || peer_id == 0) {
    alert("No text supplied or invalid peer id");
  } else {
    if (document.getElementById("datachannel").checked) {
	  var msg = JSON.stringify({
                    "messageType": "userChatMsg",
                    "messageContent": text
                 });
	  if(is_request_side == 1) 
	    localDataChannel.send(msg);
	  else 
	    remoteDataChannel.send(msg);
      trace('Sent Data by webrtc datachannel: ' + text);
	} else {
	  sendToPeer(peer_id, text);
	}
  }
}

function sendpathchange() {
  if (document.getElementById("datachannel").checked) {
    if(dataChannelConnected == 1) {
      document.getElementById("send").disabled = false;
    } else {
      document.getElementById("send").disabled = true;
    }
  } else {
    
    if(my_id != -1) {
	  document.getElementById("send").disabled = false;
	} else {
	  document.getElementById("send").disabled = true;
	}
  }
}

function sendSignal(signal) {
  var peer_id = parseInt(document.getElementById("peer_id").value);
  if (!signal.length || peer_id == 0) {
    alert("No signal supplied or invalid peer id");
  } else {
    sendToPeer(peer_id, signal);
  }
}

function toggleMe(obj) {
  var id = obj.id.replace("toggle", "msg");
  var t = document.getElementById(id);
  if (obj.innerText == "+") {
    obj.innerText = "-";
    t.style.display = "block";
  } else {
    obj.innerText = "+";
    t.style.display = "none";
  }
}

function openLocalCanvas() {
  var childWinWidth = screen.availWidth / 4 * 3           
  var childWinHeight = screen.availHeight / 4 * 3   	  
  var aleft=(screen.availWidth - childWinWidth) / 2; 
  var atop=(screen.availHeight - childWinHeight) / 2; 
  var params="top=" + atop + ",left=" + aleft + ",width=" + childWinWidth + ",height=" + childWinHeight + "," ;
  canvasWindow = window.open("canvas_jqm.html","childFrame",
					         params + "menubar=no, \
						     toolbar=no, location=no, status=no, scrollbars=yes, resizable=yes");
}

function openCanvas() {
  openLocalCanvas();
  if(dataChannelConnected === 1 && canvasWindow.opener === window) {
    var msg = JSON.stringify({
                   "messageType": "openCanvasWin"
				   
                 });
    is_request_side === 1 ? localDataChannel.send(msg) : remoteDataChannel.send(msg);			 
  }
}

function testMessage(data) {
  var dubg = document.getElementById('debug');
  dubg.innerHTML =JSON.stringify(data); 
}

function clickSendFile() {
  if(dataChannelConnected === 0 || activeDataChannel === null) {
    alert("数据通道还没建立，请等数据通道建立完毕再发送文件。");
	return;
  }
  fileToTransmit = fileInput.files[0];
  SendFile(fileToTransmit);
}

function dragSendFile() {
  event.stopPropagation();
  event.preventDefault();

  if(dataChannelConnected === 0 || activeDataChannel === null) {
    alert("数据通道还没建立，请等数据通道建立完毕再发送文件。");
	return;
  }
  fileToTransmit = event.dataTransfer.files[0];
  
  SendFile(fileToTransmit);
}

function SendFile(file) {
  if (file.size === 0) {
    return;
  }
  
  var fileMetaData = JSON.stringify({
						"messageType": "fileMetaDataMsg",
						"fileMetaData":{"fileName": file.name,
									    "fileSize": file.size,
									    "fileType": file.type,
										"fileLastModifiedDate": file.lastModifiedDate}
                       });
  activeDataChannel.send(fileMetaData);	
}

function SendFileBody(file) {
  fileInput.disabled = true;
  fileProgressDisplay("Send", true);   
  trace('file is ' + [file.name, file.size, file.type,
        file.lastModifiedDate].join(' '));
  sendProgress.max = file.size;
  var chunkSize = 16384;
  var delay = 10;   
  var sliceFile = function(offset) {
    var reader = new window.FileReader();
    reader.onload = (function() {
      return function(e) {
	    try {
		  var fileChunk = e.target.result;
		  activeDataChannel.send(fileChunk);	
		} catch(error) {
	      trace("error: " + error.description);
		  fileInput.disabled = false;
		}
        if (file.size > offset + e.target.result.byteLength) {
          window.setTimeout(sliceFile, delay, offset + chunkSize);
        } else { 
		  fileInput.disabled = false;
		  fileProgressDisplay("Both", false);    
		}
        sendProgress.value = offset + e.target.result.byteLength;
      };
    })(file);
    var slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  };
  sliceFile(0);
}

function setRecvFileMetaData(fileMetaData) {
  recvFileMetaData = fileMetaData;
  receiveProgress.max = recvFileMetaData.fileSize;
  receiveProgress.value = 0;
  recvFileDataSize = 0;
  fileInput.disabled = true;
  fileProgressDisplay("Recv", true); 
}

function onReceiveFileChunk(fileChunk) {
  if(getType(recvFileMetaData) === "undefined") {
    alert("错误：文件元数据还没收到，无法传输文件主体数据");
    return;
  }
  receiveBuffer.push(fileChunk);
  recvFileDataSize += fileChunk.byteLength;

  receiveProgress.value = recvFileDataSize;

  if (recvFileDataSize === recvFileMetaData.fileSize) {    
    var received = new window.Blob(receiveBuffer);
    receiveBuffer = [];

    downloadDiv.href = URL.createObjectURL(received);
    downloadDiv.download = recvFileMetaData.fileName;
    var text = 'Click to download \'' + recvFileMetaData.fileName + '\' (' + recvFileMetaData.fileSize +
        ' bytes) ';
	if(downloadDiv.hasChildNodes()) {
	  downloadDiv.removeChild(downloadDiv.firstChild);
	}
    downloadDiv.appendChild(document.createTextNode(text));
    downloadDiv.style.display = 'block';
    fileInput.disabled = false;
	fileProgressDisplay("Both", false);      
	recvFileEn = false;                        
	
	if(recvFileMetaData.fileType.substr(0, 5) === "image" &&
	   getType(canvasWindow) !== "undefined" ) {
	  if(canvasWindow.closed === false) {
	    var drawing = canvasWindow.drawing;
	    drawing.drawImage(received);
	  }
	}
  }
}