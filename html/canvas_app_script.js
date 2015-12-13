
function startScript(canvasId)
{ 
    originalWindow = window.opener;  
	playbackInterruptCommand = "";  
	
	$(document).bind("pageinit", function()
	{
		$("#pauseBtn").hide();
		$("#playBtn").hide();
		drawing = new RecordableDrawing(canvasId);
	
		$("#recordBtn").click(function(){
		    var btnTxt = $("#recordBtn .ui-btn-text").text();
			if (btnTxt == 'Stop')
				stopRecording();
			else
			{
				startRecording();
			}
		});
		
		$("#playBtn").click(playRecordings);

		function playRecordings()
		{
			if (drawing.recordings.length == 0)
			{
				alert("No recording to play");
				return;
			}
			var btnTxt = $("#playBtn .ui-btn-text").text();
			if (btnTxt == 'Stop')
			{
				stopPlayback();
			}
			else
			{
				startPlayback();
				var btnTxt = $("#playBtn .ui-btn-text").text();
			}				
		}

		$("#pauseBtn").click(function(){
			var btnTxt = $("#pauseBtn .ui-btn-text").text();
			if (btnTxt == 'Pause')
			{
				pausePlayback();
				var audio = document.getElementById("audio");
			} else if (btnTxt == 'Resume')
			{
				resumePlayback();
				audioRecoder.resume(audio);
			}
		});
		$("#clearBtn").click(function(){
			drawing.clearCanvas();			
		});
		
		function readBlobAsDataURL(blob, callback) 
		{
			var a = new FileReader();
			a.onload = function(e) 
			{
			    callback(e.target.result);
			}
			a.readAsDataURL(blob);
		}
		
		$("#selectFile").change(function() {
			var selectedFileEl = window.document.querySelector('input#selectFile');
			var selectedFile = selectedFileEl.files[0];
			playRecordFile(selectedFile.name);
		});
		
		function playRecordFile(file){
			try {
				$.getJSON(file, function(data){  
					var result = deserializeDrawing(data);
					if (result == null)
						result = "Error : Unknown error in deserializing the data";
					if (result instanceof Array == false)
					{
						$("#serDataTxt").val(result.toString());
						return;
					} 
					else
					{
						drawing.recordings = result;
						for (var i = 0; i < result.length; i++)
							result[i].drawing = drawing;
						playRecordings();
					}
					
				});  
			}
			catch (e){
				allert("error" + e.description);
				return;
			}
		};
	    
		function dataURLtoBlob(dataURL)
		{
			var arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1],
				bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
			while(n--)
			{
				u8arr[n] = bstr.charCodeAt(n);
			}
			return new Blob([u8arr], {type:mime});
		}
	});
	
	function stopRecording()
	{
		$("#recordBtn .ui-btn-text").text("Record");
		$("#playBtn").show();
		$("#pauseBtn").hide();
		$("#clearBtn").show();
		
		drawing.stopRecording();
		audioRecoder.stop();
	}
	
	function startRecording()
	{
		$("#recordBtn .ui-btn-text").text("Stop");
		$("#playBtn").hide();
		$("#pauseBtn").hide();
		$("#clearBtn").hide();
		
		drawing.startRecording();
        audioRecoder = new AudioRecoder();
        audioRecoder.start();
	}
	
	function stopPlayback()
	{
		playbackInterruptCommand = "stop";		
	}
	
	function startPlayback()
	{
		drawing.playRecording(function() {
			//on playback start
			$("#playBtn .ui-btn-text").text("Stop");
			$("#recordBtn").hide();
			$("#pauseBtn").show();
			$("#clearBtn").hide();
			playbackInterruptCommand = "";
		}, function(){
			//on playback end
			$("#playBtn .ui-btn-text").text("Play");
			$("#playBtn").show();
			$("#recordBtn").show();
			$("#pauseBtn").hide();
			$("#clearBtn").show();
		}, function() {
			//on pause
			$("#pauseBtn .ui-btn-text").text("Resume");
			$("#recordBtn").hide();
			$("#playBtn").hide();
			$("#clearBtn").hide();
		}, function() {
			return playbackInterruptCommand;
		});
	}
	
	function pausePlayback()
	{
		playbackInterruptCommand = "pause";
	}
	
	function resumePlayback()
	{
		playbackInterruptCommand = "";
		drawing.resumePlayback(function(){
			$("#pauseBtn .ui-btn-text").text("Pause");
			$("#pauseBtn").show();
			$("#recordBtn").hide();
			$("#playBtn").show();
			$("#clearBtn").hide();
		});
	}
}
