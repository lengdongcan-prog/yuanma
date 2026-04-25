import json
import os
import uuid
from app.core.database import SessionLocal
from app.models.task import Task, TaskStatus
from app.services.ai.llm_service import LLMService
from app.config import settings


def generate_detail_page(task_id: int, params: dict):
    """生成电商详情页"""
    db = SessionLocal()
    
    # 从数据库中获取默认的AI配置
    from app.models.ai_config import AIConfig
    ai_config = db.query(AIConfig).filter(
        AIConfig.model_type == 'image',
        AIConfig.is_default == True,
        AIConfig.status == 'enabled'
    ).first()
    
    # 如果没有找到默认配置，使用模拟配置
    if not ai_config:
        llm_service = LLMService("default-model")
    else:
        llm_service = LLMService(
            model_id=ai_config.model_id,
            api_key=ai_config.api_key,
            api_base=ai_config.api_base
        )
    
    try:
        # 更新任务状态为处理中
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = TaskStatus.PROCESSING
            db.commit()
        
        # 提取参数
        product_name = params.get('product_name')
        product_description = params.get('product_description')
        product_features = params.get('product_features')
        platform = params.get('platform')
        image_size = params.get('image_size')
        generate_count = params.get('generate_count', 5)
        custom_prompt = params.get('custom_prompt')
        image_ids = params.get('image_ids', [])
        
        # 构建提示词
        base_prompt = f"""创建一个电商产品详情页，产品信息如下：
产品名称：{product_name}
产品描述：{product_description}
核心卖点：{product_features}
平台：{platform}
尺寸：{image_size}

请创建一个专业、吸引人的详情页，包含产品展示、功能介绍、使用场景等元素。"""
        
        if custom_prompt:
            base_prompt += f"\n\n自定义提示词：{custom_prompt}"
        
        # 生成图片
        generated_images = {}
        
        # 处理不同尺寸的生成逻辑
        if image_size == "advanced-a-plus-both":
            # 同时生成电脑端和移动端两套图
            desktop_images = []
            mobile_images = []
            
            # 生成电脑端图片 (1464×600)
            for i in range(generate_count):
                try:
                    # 生成图片
                    image_url = llm_service.generate_image(
                        prompt=base_prompt + " ultra-wide banner, panoramic product showcase, hero image composition",
                        size="1464x600"
                    )
                    
                    # 保存图片到本地
                    import requests
                    response = requests.get(image_url)
                    if response.status_code == 200:
                        # 生成唯一文件名
                        file_extension = ".png"
                        unique_filename = f"desktop_{i+1}_{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
                        
                        # 确保上传目录存在
                        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
                        
                        # 保存文件
                        with open(file_path, "wb") as f:
                            f.write(response.content)
                        
                        # 添加到结果
                        desktop_images.append({
                            "url": f"/uploads/{unique_filename}",
                            "path": unique_filename
                        })
                except Exception as e:
                    print(f"Error generating desktop image {i+1}: {e}")
                    continue
            
            # 生成移动端图片 (600×450)
            for i in range(generate_count):
                try:
                    # 生成图片
                    image_url = llm_service.generate_image(
                        prompt=base_prompt + " horizontal product shot, clean composition, mobile-friendly layout",
                        size="600x450"
                    )
                    
                    # 保存图片到本地
                    import requests
                    response = requests.get(image_url)
                    if response.status_code == 200:
                        # 生成唯一文件名
                        file_extension = ".png"
                        unique_filename = f"mobile_{i+1}_{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
                        
                        # 确保上传目录存在
                        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
                        
                        # 保存文件
                        with open(file_path, "wb") as f:
                            f.write(response.content)
                        
                        # 添加到结果
                        mobile_images.append({
                            "url": f"/uploads/{unique_filename}",
                            "path": unique_filename
                        })
                except Exception as e:
                    print(f"Error generating mobile image {i+1}: {e}")
                    continue
            
            generated_images = {
                "desktop": desktop_images,
                "mobile": mobile_images
            }
        else:
            # 生成单套图
            single_images = []
            
            # 根据平台和尺寸设置生成参数
            size_map = {
                "1:1": "1024x1024",
                "3:4": "1024x1280",
                "9:16": "1024x1792",
                "16:9": "1792x1024",
                "1464x600": "1464x600",
                "600x450": "600x450",
                "970x600": "970x600"
            }
            size = size_map.get(image_size, "1024x1024")
            
            # 根据尺寸添加额外提示词
            extra_prompt = ""
            if image_size == "1464x600":
                extra_prompt = " ultra-wide banner, panoramic product showcase, hero image composition"
            elif image_size == "970x600":
                extra_prompt = " horizontal banner, e-commerce hero image, lifestyle composition"
            elif image_size == "600x450":
                extra_prompt = " horizontal product shot, clean composition, mobile-friendly layout"
            elif image_size == "3:4":
                extra_prompt = " portrait orientation, vertical composition, mobile-first layout"
            elif image_size == "9:16":
                extra_prompt = " tall banner, vertical poster layout, mobile wallpaper composition"
            
            for i in range(generate_count):
                try:
                    # 生成图片
                    image_url = llm_service.generate_image(
                        prompt=base_prompt + extra_prompt,
                        size=size
                    )
                    
                    # 保存图片到本地
                    import requests
                    response = requests.get(image_url)
                    if response.status_code == 200:
                        # 生成唯一文件名
                        file_extension = ".png"
                        unique_filename = f"generated_{i+1}_{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
                        
                        # 确保上传目录存在
                        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
                        
                        # 保存文件
                        with open(file_path, "wb") as f:
                            f.write(response.content)
                        
                        # 添加到结果
                        single_images.append({
                            "url": f"/uploads/{unique_filename}",
                            "path": unique_filename
                        })
                except Exception as e:
                    print(f"Error generating image {i+1}: {e}")
                    continue
            
            generated_images = {"images": single_images}
        
        # 更新任务状态和结果
        if task:
            task.status = TaskStatus.COMPLETED
            task.result = json.dumps({**generated_images, "message": "生成成功"})
            db.commit()
            
    except Exception as e:
        print(f"Error in generate_detail_page: {e}")
        # 更新任务状态为失败
        if task:
            task.status = TaskStatus.FAILED
            task.result = json.dumps({"error": str(e)})
            db.commit()
    finally:
        db.close()