#webRTC结合HTML5的Canvas的Demo
---
##说明
这是一个WebRTC网页客户端demo，在我之前写的[original_webrtc_client](https://github.com/OceanSunlight/original_webrtc_client)基础上增加了DataChannel和Canvas。
展示了通信双方如何建立各自的DataChannel，并使用DataChannel进行应用数据传输的过程，用WebRTC的DataChannel结合HTML5的Canvas实现了电子白板交互、图片共享、文件传输功能。

##模块介绍
adapter.js是WebRTC官方的模块，用于提供日志、getUserMedia不同浏览器的适配等功能。
HarryRtcServer.exe功能见[original_webrtc_client](https://github.com/OceanSunlight/original_webrtc_client)。
communication_server.js主要用于和信令服务器进行通信，使用XHR，向服务器发送用户请求、解析并处理返回的HTTP响应报文，主要和信令服务器通信交互媒体信令并处理，媒体信令包括用户登录注册和注销、offer-SDP、answer-SDP、candidate、BYE。
peerconnection.js模块中调用了WebRTC提供RTCPeerConnection和MediaStream的js开发接口，打开本地音视频设备获取媒体流、建立点对点的音视频传输通道以及用户应用数据的传输通道。

##使用
1. 在一台电脑上运行信令服务器HarryRtcServer.exe，作为信令服务器；
2. 想要通信的双方，分别在自己的chrome或Firefox浏览器的地址栏中输入步骤1中的服务器IP；
3. 点击Connect按钮登陆服务器，连接上服务器后会提示打开本地摄像头，服务器会分配一个身份号peer_id给你；
4. 根据对方的peer_id，进行呼叫、挂断、发送信息操作。
5. 点击选择文件或把指定文件拖动到它上面来发送文件，接收到对方文件会有用户提示：确认接收还是拒绝接收。
6. 点击Canvas打开白板窗口，在白板上书写的字迹会通过DataChannel传输到另一个用户的白板上。
7. 点击Record开始录制白板上书写的轨迹，点击Play可以播放之前录制的白板轨迹。
8. 将要共享的图片拖放到标签Canvas上，对方若打开了Canvas窗口且双方已建立了DataCannel，被拖放的图片会在对方Canvas窗口上显示；另外把其他文件拖放到Canvas上，也可以传输文件。
##功能说明
网页音视频传输、文字和文件传输、基于canvas的电子白板共享、图片共享、白板录制播放。

##canvas_webrtc_client链接
[canvas_webrtc_client](https://github.com/OceanSunlight/canvas_webrtc_client)

