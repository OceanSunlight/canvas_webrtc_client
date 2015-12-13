
Transport = function ()
{
    var self = this;
	this.message = null;
	this.sendMessage = function (msgType, message) 
	{
	    self.message = message;
	    if(typeof originalWindow !== "undefined") 
		{   
		    var msg = JSON.stringify({
                  "messageType": msgType,
                  "message": self.message
               });
	        self.sendMsgByTop(msg);
	    }
	}
	this.sendMsgByTop = function (msg) 
	{
		if(originalWindow.dataChannelConnected) {
			originalWindow.is_request_side === 1 ? originalWindow.localDataChannel.send(msg) 
				: originalWindow.remoteDataChannel.send(msg);
        }
    }
  
	this.sendFileByParent = function (file) {
		if(originalWindow.dataChannelConnected === 1 && 
			originalWindow.activeDataChannel !== null) 
		{
			originalWindow.SendFile(file);
		}
	}
}

RecordableDrawing = function (canvasId)
{
	var self = this;
	this.canvas = null;
	this.width = this.height = 0;
	this.actions = new Array();
	this.ctx = null;
	this.mouseDown = false;
	this.rmouseDown = false;      
	this.currentRecording = null;
	this.recordings = new Array(); 
	this.lastMouseX = this.lastMouseY = -1;
	this.bgColor = "rgb(255,255,255)";
	this.transPort = new Transport();
	var currentLineWidth = 5;
	var drawingColor = "rgb(0,0,0)";
	var pauseInfo = null;
	
	onDragDropPic = function()
	{
	    event.stopPropagation();
	    event.preventDefault();
	    originalWindow.fileToTransmit = event.dataTransfer.files[0];
		var pic = originalWindow.fileToTransmit;
		if(pic.type.substr(0, 5) === "image")
		{
			self.drawImage(pic);
		}
	    self.transPort.sendFileByParent(originalWindow.fileToTransmit);
	}
	
	this.drawImage = function (file) 
	{
		var img = new Image();
		var imageURL = window.URL.createObjectURL(file);
		img.onload = function() 
		{ 
			self.ctx.drawImage(img, 0, 0, self.canvas.width, self.canvas.height);
			window.URL.revokeObjectURL(imageURL);
		}
		img.src = imageURL;
	}
	
	onMouseDown = function(event)
	{
		var canvasX = $(self.canvas).offset().left;
		var canvasY = $(self.canvas).offset().top;
		
		self.mouseDown = true;
		var x = Math.floor(event.pageX - canvasX);
		var y = Math.floor(event.pageY - canvasY);
		
		var	currAction = new Point(x,y,0);
		self.drawAction(currAction,true);
		self.transPort.sendMessage("mouseDownMsg", currAction);              
		if (self.currentRecording != null)
			self.currentRecording.addAction(currAction);
		event.preventDefault();
		return false;
	}
	
	onMouseMove = function(event)
	{
		if (self.mouseDown)
		{
			var canvasX = $(self.canvas).offset().left;
			var canvasY = $(self.canvas).offset().top;
			
			var x = Math.floor(event.pageX - canvasX);
			var y = Math.floor(event.pageY - canvasY);
			
			var action = new Point(x,y,1);
			
			if (self.currentRecording != null)
				self.currentRecording.addAction(action);
			self.drawAction(action, true);
			self.transPort.sendMessage("mouseMoveMsg", action);              
				
			event.preventDefault();
			self.lastMouseX = x;
			self.lastMouseY = y;
			return false;
		}
	}
	
	onMouseUp = function(event)
	{
		self.mouseDown = false;
		self.lastMouseX = -1;
		self.lastMouseY = -1;
		self.transPort.sendMessage("mouseUpMsg", null);               
	}
	
	this.recvMouseDown = function(action) 
	{
		self.rmouseDown = true;
        self.drawAction(action, false);
		if (self.currentRecording != null)
			self.currentRecording.addAction(action);
	}
	
	this.recvMouseMove = function(action) 
	{
	    if (self.rmouseDown)
		{
		    if (self.currentRecording != null)
			    self.currentRecording.addAction(action);
			self.drawAction(action, false);
		}
	}
	
	this.recvMouseUp = function() 
	{
	    self.rmouseDown = false;
	} 
	
	this.recvRecordActions = function(actionArray) 
	{
	    if (self.currentRecording != null)
			self.currentRecording.addAction(action);
		if (actionArray === null)  
		{
		    self.clearCanvas("emptyListElement");
		} else {
		    for (var i = 0; i < actionArray.length; i++)
				self.drawAction(actionArray[i],false);        
		}
	} 
	
	this.startRecording = function()
	{
		self.currentRecording = new Recording(this);
		self.recordings = new Array();
		self.recordings.push(self.currentRecording);
		self.currentRecording.start();
	}
	
	this.stopRecording = function()
	{
		if (self.currentRecording != null)
			self.currentRecording.stop();
		self.currentRecording = null;
	}
	
	this.playRecording = function(onPlayStart, onPlayEnd, onPause, interruptActionStatus)
	{
		if (typeof interruptActionStatus == 'undefined')
			interruptActionStatus = null;
		
		if (self.recordings.length == 0)
		{
			alert("No recording loaded to play");
			onPlayEnd();
			return;
		}

		self.clearCanvas();
		
		onPlayStart();
		
		self.pausedRecIndex = -1;
		
		for (var rec = 0; rec < self.recordings.length; rec++)
		{
			if (interruptActionStatus != null)
			{
				var status = interruptActionStatus();
				if (status == "stop") {
					pauseInfo = null;
					break;
				}
				else 
					if (status == "pause") {
						__onPause(rec-1, onPlayEnd, onPause, interruptActionStatus);
						break;
					}
			}
			self.recordings[rec].playRecording(self.drawActions, onPlayEnd, function(){
				__onPause(rec-1, onPlayEnd, onPause, interruptActionStatus);
			}, interruptActionStatus);
		}
	}

	function __onPause(index, onPlayEnd, onPause, interruptActionStatus)
	{
		pauseInfo = {
			"index": index,
			"onPlayend": onPlayEnd,
			"onPause":onPause,
			"interruptActionStatus": interruptActionStatus
		};
		if (onPause)
			onPause();
	}
		
	this.resumePlayback = function (onResume)
	{
		if (pauseInfo == null) {
			if (onResume)
				onResume(false);
			return;
		}
		
		var index = pauseInfo.index;
		var onPlayEnd = pauseInfo.onPlayend;
		var interruptActionStatus = pauseInfo.interruptActionStatus;
		var onPause = pauseInfo.onPause;
		
		if (self.recordings.length == 0)
		{
			alert("No recording loaded to play");
			onPlayEnd();
			return;
		}

		onResume(true);
		
		pauseInfo = null;
		
		for (var rec = index; rec < self.recordings.length; rec++)
		{
			if (interruptActionStatus != null)
			{
				var status = interruptActionStatus();
				if (status == "stop")
					break;
				else if (status == "pause")
				{
					__onPause(rec-1, onPlayEnd, onPause, interruptActionStatus);
					break;		
				}
			}
			self.recordings[rec].playRecording(self.drawActions, onPlayEnd, function(){
				__onPause(rec-1, onPlayEnd, onPause, interruptActionStatus);
			},interruptActionStatus);
		}
	}

	this.clearCanvas = function(arg)
	{
		self.ctx.fillStyle = self.bgColor;
		self.ctx.fillRect(0,0,self.canvas.width,self.canvas.height);
        if (typeof arg === "string")		
		{
		    if( arg === "emptyListElement")
               return;
		}
		if (self.currentRecording != null)        
		    self.currentRecording.addEmptyElement();
		
        if(typeof arg === "undefined")   
		{   
			self.transPort.sendMessage("clearCanvasMsg", null); 
		}			
	}
 	
	this.removeAllRecordings = function()
	{
		self.recordings = new Array()
		self.currentRecording = null;
	}
	
	this.drawAction = function (actionArg, addToArray)
	{
		var x = actionArg.x;
		var y = actionArg.y;
		
		switch (actionArg.type)
		{
		case 0: //moveto
			self.ctx.beginPath();
			self.ctx.moveTo(x, y);
			self.ctx.strokeStyle = self.drawingColor;
			self.ctx.lineWidth = self.currentLineWidth;			
			break;
		case 1: //lineto
			self.ctx.lineTo(x,y);
			self.ctx.stroke();
			break;
		}
		if (addToArray)
			self.actions.push(actionArg);
	}	
		
	__init = function()
	{
		self.canvas = $("#" + canvasId);
		if (self.canvas.length == 0)
		{
			alert("No canvas with id " + canvasId + " found");
			return;
		} 
		self.canvas = self.canvas.get(0);
		self.width = $(self.canvas).width();
		self.height = $(self.canvas).height();
		self.ctx = self.canvas.getContext("2d");
		
		$(self.canvas).bind("vmousedown", onMouseDown);
		$(self.canvas).bind("vmouseup", onMouseUp);
		$(self.canvas).bind("vmousemove", onMouseMove);
		$(self.canvas).bind("dragover", function(event) {
								   event.preventDefault();
				                });
		$(self.canvas).bind("drop", onDragDropPic);
		
		self.clearCanvas();		
	}
	
	__init();
}

Recording = function (drawingArg)
{
	var self = this;
	this.drawing = drawingArg;
	this.timeSlots = new Object();
	
	this.buffer = new Array(); 
	this.timeInterval = 100; 
	this.currTime = 0;
	this.started = false;
	this.intervalId = null;
	this.currTimeSlot = 0;
	this.actionsSet = null;
	this.currActionSet = null;
	this.recStartTime = null;
	this.pauseInfo = null;
	
	this.start = function()
	{
		self.currTime = 0;
		self.currTimeSlot = -1;
		self.actionsSet = null;
		self.pauseInfo = null;
		
		self.recStartTime = (new Date()).getTime();
		self.intervalId = window.setInterval(self.onInterval, self.timeInterval);
		self.started = true;
	}
	
	this.stop = function()
	{
		if (self.intervalId != null)
		{
			window.clearInterval(self.intervalId);
			self.intervalId = null;
		}
		self.started = false;
	}
	
	this.onInterval = function()
	{
		if (self.buffer.length > 0)
		{
			var timeSlot = (new Date()).getTime() - self.recStartTime;
		
			if (self.currActionSet == null)
			{
				self.currActionSet = new ActionsSet(timeSlot, self.buffer);
				self.actionsSet = self.currActionSet;
			}
			else
			{
				var tmpActionSet = self.currActionSet;
				self.currActionSet = new ActionsSet(timeSlot, self.buffer);
				tmpActionSet.next = self.currActionSet;
			}
			
			self.buffer = new Array();
		}
		self.currTime += self.timeInterval;
	}
	
	this.addAction = function(actionArg)
	{
		if (!self.started)
			return;
		self.buffer.push(actionArg);
	}
	
	this.playRecording = function(callbackFunctionArg, onPlayEnd, onPause, interruptActionStatus)
	{
		if (self.actionsSet == null)
		{
			if (typeof onPlayEnd != 'undefined' && onPlayEnd != null)
				onPlayEnd();
			return;
		}	

		self.scheduleDraw(self.actionsSet,self.actionsSet.interval,callbackFunctionArg, onPlayEnd, onPause, true, interruptActionStatus);
	}

	this.scheduleDraw = function (actionSetArg, interval, callbackFunctionArg, onPlayEnd, onPause, isFirst, interruptActionStatus)
	{
		window.setTimeout(function(){
			var status = "";
			if (interruptActionStatus != null)
			{
				status = interruptActionStatus();
				if (status == 'stop')
				{
					self.pauseInfo = null;
					onPlayEnd();
					return;
				}
			}
			
			if (status == "pause")
			{
				self.pauseInfo = {
					"actionset":actionSetArg,
					"callbackFunc":callbackFunctionArg,
					"onPlaybackEnd":onPlayEnd,
					"onPause":onPause,
					"isFirst":isFirst,
					"interruptActionsStatus":interruptActionStatus
				};
				
				if (onPause)
					onPause();
				return;
			}
			
			var intervalDiff = -1;
			var isLast = true;
			if (actionSetArg.next != null)
			{
				isLast = false;
				intervalDiff = actionSetArg.next.interval - actionSetArg.interval;
			}
			if (intervalDiff >= 0)
				self.scheduleDraw(actionSetArg.next, intervalDiff, callbackFunctionArg, onPlayEnd, onPause, false,interruptActionStatus);
            if (actionSetArg.actions === null) 
			{
			    self.drawing.clearCanvas("emptyListElement");
				self.drawing.transPort.sendMessage("recordActionsMsg", null);  
				if (isLast)
				{
					onPlayEnd();
				}
			} else {
			    self.drawActions(actionSetArg.actions, onPlayEnd, isFirst, isLast);
				self.drawing.transPort.sendMessage("recordActionsMsg", actionSetArg.actions);             
			}
			
		},interval);
	}
	
	this.resume = function()
	{
		if (!self.pauseInfo)
			return;
		
		self.scheduleDraw(self.pauseInfo.actionset, 0, 
			self.pauseInfo.callbackFunc, 
			self.pauseInfo.onPlaybackEnd, 
			self.pauseInfo.onPause,
			self.pauseInfo.isFirst,
			self.pauseInfo.interruptActionsStatus);
			
		self.pauseInfo = null;
	}	
	
	this.drawActions = function (actionArray, onPlayEnd, isFirst, isLast)
	{
		for (var i = 0; i < actionArray.length; i++)
			self.drawing.drawAction(actionArray[i],false);
			
		if (isLast)
		{
			onPlayEnd();
		}
	}
	  
	this.addEmptyElement = function ()
	{
	    var timeSlot = (new Date()).getTime() - self.recStartTime;
		
			if (self.currActionSet == null)
			{
				self.currActionSet = new ActionsSet(timeSlot, null);
				self.actionsSet = self.currActionSet;
			}
			else
			{
				var tmpActionSet = self.currActionSet;
				self.currActionSet = new ActionsSet(timeSlot, null);
				tmpActionSet.next = self.currActionSet;
			}
	}
}

Action = function()
{
	var self = this;
	this.actionType; 
	this.x = 0;
	this.y = 0;
	this.isMovable = false;
	this.index = 0;
	
	if (arguments.length > 0)
	{
		self.actionType = arguments[0];
	}
	if (arguments.length > 2)
	{
		self.x = arguments[1];
		self.y = arguments[2];
	}
}

Point = function (argX,argY,typeArg)
{
	var self = this;
	this.type = typeArg; //0 - moveto, 1 - lineto
	
	Action.call(this,1,argX,argY);
}

Point.prototype = new Action();

ActionsSet = function (interalArg, actionsArrayArg)
{
	var self = this;
	
	this.actions = actionsArrayArg;
	this.interval = interalArg;
	this.next = null;
}