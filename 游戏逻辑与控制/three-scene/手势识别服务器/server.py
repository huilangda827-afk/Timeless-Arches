#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MediaPipe 手势识别 WebSocket 服务器
用于将手势识别数据通过 WebSocket 发送到前端

依赖：
    pip install mediapipe opencv-python websockets

运行：
    python server.py
"""

import asyncio
import json
import websockets
import cv2
import mediapipe as mp
import numpy as np
from typing import Optional, Tuple

# MediaPipe Hands 初始化
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# 手势状态
gesture_state = {
    "gesture": "none",  # none, open, fist, point
    "x": 0.5,
    "y": 0.5,
    "connected": False
}

def detect_gesture(landmarks) -> str:
    """
    检测手势类型
    返回: "none", "open", "fist", "point"
    """
    if not landmarks or len(landmarks) < 21:
        return "none"
    
    # 获取关键点
    thumb_tip = landmarks[4]
    thumb_ip = landmarks[3]
    index_tip = landmarks[8]
    index_pip = landmarks[6]
    middle_tip = landmarks[12]
    middle_pip = landmarks[10]
    ring_tip = landmarks[16]
    ring_pip = landmarks[14]
    pinky_tip = landmarks[20]
    pinky_pip = landmarks[18]
    
    # 判断手指是否伸直（tip y < pip y，因为图像坐标系y向下）
    fingers_up = [
        thumb_tip.x > thumb_ip.x,  # 拇指（特殊判断）
        index_tip.y < index_pip.y,  # 食指
        middle_tip.y < middle_pip.y,  # 中指
        ring_tip.y < ring_pip.y,  # 无名指
        pinky_tip.y < pinky_pip.y  # 小指
    ]
    
    # 手势判断
    if all(fingers_up):
        return "open"
    elif not any(fingers_up[1:]):  # 除了拇指，其他手指都弯曲
        return "fist"
    elif fingers_up[1] and not any(fingers_up[2:]):  # 只有食指伸直
        return "point"
    else:
        return "none"

def process_hand_landmarks(landmarks, image_width: int, image_height: int) -> Tuple[str, float, float]:
    """
    处理手部关键点，返回手势类型和归一化坐标
    """
    if not landmarks:
        return "none", 0.5, 0.5
    
    # 获取手腕位置（作为手的位置）
    wrist = landmarks[0]
    x = wrist.x  # 已经是归一化坐标 (0-1)
    y = wrist.y  # 已经是归一化坐标 (0-1)
    
    # 检测手势
    gesture = detect_gesture(landmarks)
    
    return gesture, x, y

async def handle_client(websocket, path):
    """
    处理 WebSocket 客户端连接
    """
    print(f"[服务器] 客户端已连接: {websocket.remote_address}")
    gesture_state["connected"] = True
    
    # 打开摄像头
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[服务器] ❌ 无法打开摄像头")
        await websocket.close()
        return
    
    print("[服务器] ✅ 摄像头已启动")
    
    try:
        while True:
            # 读取摄像头帧
            ret, frame = cap.read()
            if not ret:
                break
            
            # 水平翻转（镜像效果）
            frame = cv2.flip(frame, 1)
            
            # 转换颜色空间（BGR -> RGB）
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # MediaPipe 处理
            results = hands.process(rgb_frame)
            
            # 处理识别结果
            if results.multi_hand_landmarks:
                # 使用第一只手
                hand_landmarks = results.multi_hand_landmarks[0]
                gesture, x, y = process_hand_landmarks(
                    hand_landmarks.landmark,
                    frame.shape[1],
                    frame.shape[0]
                )
                
                gesture_state["gesture"] = gesture
                gesture_state["x"] = x
                gesture_state["y"] = y
            else:
                gesture_state["gesture"] = "none"
                gesture_state["x"] = 0.5
                gesture_state["y"] = 0.5
            
            # 发送手势数据到客户端
            data = {
                "gesture": gesture_state["gesture"],
                "x": gesture_state["x"],
                "y": gesture_state["y"]
            }
            
            try:
                await websocket.send(json.dumps(data))
            except websockets.exceptions.ConnectionClosed:
                print("[服务器] 客户端已断开连接")
                break
            
            # 控制帧率（约30fps）
            await asyncio.sleep(1/30)
            
    except Exception as e:
        print(f"[服务器] ❌ 错误: {e}")
    finally:
        cap.release()
        gesture_state["connected"] = False
        print("[服务器] 摄像头已关闭")

async def main():
    """
    启动 WebSocket 服务器
    """
    host = "localhost"
    port = 12345
    
    print(f"[服务器] 正在启动 WebSocket 服务器...")
    print(f"[服务器] 地址: ws://{host}:{port}")
    print(f"[服务器] 等待客户端连接...")
    
    async with websockets.serve(handle_client, host, port):
        await asyncio.Future()  # 永久运行

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[服务器] 服务器已停止")

