#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MediaPipe 手势识别 WebSocket 服务器（重写版）
用于将手势识别数据通过 WebSocket 发送到前端

依赖：
    pip install mediapipe opencv-python websockets

运行：
    python server.py
"""

import asyncio
import json
import sys

# 更友好的依赖检测：如果某些库未安装，给出明确安装提示并退出
missing = []
try:
    import websockets
except Exception:
    missing.append('websockets')
try:
    import cv2
except Exception:
    missing.append('opencv-python (cv2)')
try:
    import mediapipe as mp
except Exception:
    missing.append('mediapipe')

if missing:
    print('\n[服务器] 错误：缺少 Python 依赖：' + ', '.join(missing))
    print('[服务器] 请按以下步骤修复（在 PowerShell 或 CMD 中运行）：')
    print('  1) 创建并激活虚拟环境（可选但推荐）：')
    print('       python -m venv .venv')
    print('       .\\.venv\\Scripts\\Activate.ps1  # PowerShell')
    print('       .\\.venv\\Scripts\\activate.bat   # CMD')
    print('  2) 升级 pip：')
    print('       python -m pip install --upgrade pip')
    print('  3) 安装依赖：')
    print('       pip install websockets opencv-python mediapipe')
    print("     注意：在部分 Windows 环境上安装 'mediapipe' 可能失败，若失败请尝试使用 conda 或参考项目文档中的安装建议。")
    print('  4) 然后重新运行： python server.py')
    sys.exit(1)
from typing import Optional, Tuple

# ===================== 全局配置 =====================
HOST = "localhost"
PORT = 12345
FPS = 30
CAMERA_INDEX = 0  # 默认摄像头索引，如果0不行可以尝试1, 2...

# ===================== MediaPipe 初始化 =====================
print("[服务器] 正在初始化 MediaPipe Hands...")
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,  # 只检测一只手，简化逻辑
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5,
    model_complexity=1  # 0=轻量, 1=标准, 2=完整
)
print("[服务器] ✅ MediaPipe Hands 初始化完成")

# ===================== 手势检测函数 =====================
def detect_gesture(landmarks) -> str:
    """
    检测手势类型
    返回: "none", "open", "fist", "point"
    """
    if not landmarks or len(landmarks) < 21:
        return "none"
    
    # 获取关键点索引
    # MediaPipe Hands 有21个关键点：0=手腕, 4=拇指尖, 8=食指尖, 12=中指尖, 16=无名指尖, 20=小指尖
    wrist = landmarks[0]
    thumb_tip = landmarks[4]
    thumb_ip = landmarks[3]  # 拇指指间关节
    index_tip = landmarks[8]
    index_pip = landmarks[6]  # 食指近端指间关节
    middle_tip = landmarks[12]
    middle_pip = landmarks[10]
    ring_tip = landmarks[16]
    ring_pip = landmarks[14]
    pinky_tip = landmarks[20]
    pinky_pip = landmarks[18]
    
    # 判断手指是否伸直
    # 对于拇指：比较 x 坐标（特殊处理）
    # 对于其他手指：比较 y 坐标（图像坐标系 y 向下）
    fingers_up = [
        thumb_tip.x > thumb_ip.x,  # 拇指
        index_tip.y < index_pip.y,  # 食指
        middle_tip.y < middle_pip.y,  # 中指
        ring_tip.y < ring_pip.y,  # 无名指
        pinky_tip.y < pinky_pip.y  # 小指
    ]
    
    # 手势判断逻辑
    up_count = sum(fingers_up)
    
    if up_count == 5:
        return "open"  # 所有手指都伸直
    elif up_count == 0 or (up_count == 1 and fingers_up[0]):  # 只有拇指或全部弯曲
        return "fist"  # 握拳
    elif up_count == 1 and fingers_up[1]:  # 只有食指伸直
        return "point"  # 指向
    else:
        return "none"  # 其他手势

def process_hand_landmarks(landmarks, image_width: int, image_height: int) -> Tuple[str, float, float]:
    """
    处理手部关键点，返回手势类型和归一化坐标 (0-1)
    """
    if not landmarks:
        return "none", 0.5, 0.5
    
    # 使用手腕位置作为手的位置
    wrist = landmarks[0]
    x = wrist.x  # MediaPipe 已经返回归一化坐标 (0-1)
    y = wrist.y  # MediaPipe 已经返回归一化坐标 (0-1)
    
    # 检测手势
    gesture = detect_gesture(landmarks)
    
    return gesture, x, y

# ===================== WebSocket 处理 =====================
async def handle_client(websocket, path):
    """
    处理 WebSocket 客户端连接
    """
    client_addr = websocket.remote_address
    print(f"[服务器] ✅ 客户端已连接: {client_addr}")
    
    # 尝试打开摄像头
    cap = None
    for camera_idx in [CAMERA_INDEX, 1, 2]:  # 尝试多个摄像头索引
        try:
            cap = cv2.VideoCapture(camera_idx)
            if cap.isOpened():
                # 设置摄像头参数
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_FPS, FPS)
                print(f"[服务器] ✅ 摄像头已启动 (索引: {camera_idx})")
                break
        except Exception as e:
            print(f"[服务器] ⚠️ 摄像头索引 {camera_idx} 打开失败: {e}")
            if cap:
                cap.release()
            cap = None
    
    if not cap or not cap.isOpened():
        error_msg = {
            "error": "无法打开摄像头",
            "message": "请检查摄像头是否连接并授予权限"
        }
        try:
            await websocket.send(json.dumps(error_msg))
        except:
            pass
        print("[服务器] ❌ 无法打开摄像头，关闭连接")
        await websocket.close()
        return
    
    frame_count = 0
    last_fps_time = asyncio.get_event_loop().time()
    
    try:
        while True:
            # 读取摄像头帧
            ret, frame = cap.read()
            if not ret:
                print("[服务器] ⚠️ 无法读取摄像头帧")
                await asyncio.sleep(0.1)
                continue
            
            # 水平翻转（镜像效果，更符合直觉）
            frame = cv2.flip(frame, 1)
            
            # 转换颜色空间（BGR -> RGB，MediaPipe 需要 RGB）
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # MediaPipe 处理
            results = hands.process(rgb_frame)
            
            # 处理识别结果
            gesture = "none"
            x = 0.5
            y = 0.5
            
            if results.multi_hand_landmarks:
                # 使用第一只手
                hand_landmarks = results.multi_hand_landmarks[0]
                gesture, x, y = process_hand_landmarks(
                    hand_landmarks.landmark,
                    frame.shape[1],
                    frame.shape[0]
                )
            
            # 准备发送的数据
            # 注意：x, y 是归一化坐标 (0-1)，前端需要转换为 NDC (-1 到 1)
            data = {
                "gesture": gesture,
                "x": float(x),  # 0-1 范围
                "y": float(y),  # 0-1 范围
                "timestamp": asyncio.get_event_loop().time()
            }
            
            # 发送手势数据到客户端
            try:
                await websocket.send(json.dumps(data))
            except websockets.exceptions.ConnectionClosed:
                print("[服务器] 客户端已断开连接")
                break
            except Exception as e:
                print(f"[服务器] ⚠️ 发送数据失败: {e}")
                break
            
            # 控制帧率
            await asyncio.sleep(1.0 / FPS)
            
            # 每100帧打印一次FPS
            frame_count += 1
            if frame_count % 100 == 0:
                current_time = asyncio.get_event_loop().time()
                fps = 100 / (current_time - last_fps_time)
                print(f"[服务器] FPS: {fps:.1f}")
                last_fps_time = current_time
            
    except Exception as e:
        print(f"[服务器] ❌ 错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理资源
        if cap:
            cap.release()
        print("[服务器] 摄像头已关闭，连接已断开")

async def main():
    """
    启动 WebSocket 服务器
    """
    print("=" * 50)
    print("  手势识别 WebSocket 服务器")
    print("=" * 50)
    print(f"[服务器] 地址: ws://{HOST}:{PORT}")
    print(f"[服务器] 帧率: {FPS} FPS")
    print(f"[服务器] 等待客户端连接...")
    print("=" * 50)
    print("提示：按 Ctrl+C 停止服务器")
    print()
    
    try:
        async with websockets.serve(handle_client, HOST, PORT):
            await asyncio.Future()  # 永久运行
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"[服务器] ❌ 错误：端口 {PORT} 已被占用")
            print(f"[服务器] 请关闭其他使用该端口的程序，或修改 PORT 配置")
        else:
            print(f"[服务器] ❌ 错误: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n[服务器] 服务器已停止")
        sys.exit(0)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[服务器] 服务器已停止")
