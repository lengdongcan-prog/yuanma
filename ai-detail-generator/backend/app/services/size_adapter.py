import math
from app.config import settings

def adapt_size(target_size: str, model_name: str = "default") -> dict:
    """
    尺寸适配函数
    
    Args:
        target_size: 目标尺寸，格式为"widthxheight"或比例字符串（如"1:1"）
        model_name: 模型名称，用于获取尺寸限制
    
    Returns:
        dict: 包含适配后的尺寸信息
    """
    # 解析目标尺寸
    if "x" in target_size:
        # 解析具体尺寸，如"1464x600"
        width, height = map(int, target_size.split("x"))
    elif ":" in target_size:
        # 解析比例，如"1:1"
        width_ratio, height_ratio = map(int, target_size.split(":"))
        # 默认为1024像素基准
        if width_ratio >= height_ratio:
            width = 1024
            height = int(1024 * height_ratio / width_ratio)
        else:
            height = 1024
            width = int(1024 * width_ratio / height_ratio)
    else:
        # 默认尺寸
        width, height = 1024, 1024
    
    # 计算宽高比
    aspect_ratio = width / height
    
    # 确定宽高比类型
    if aspect_ratio > 2.0:
        aspect_ratio_type = "ultra_wide"
    elif aspect_ratio > 1.3:
        aspect_ratio_type = "wide"
    elif aspect_ratio == 1.0:
        aspect_ratio_type = "square"
    else:
        aspect_ratio_type = "tall"
    
    # 从配置文件读取模型尺寸限制
    model_limits = settings.MODEL_SIZE_LIMITS.get(model_name, settings.MODEL_SIZE_LIMITS["default"])
    min_pixels = model_limits.get("min_pixels", 0)
    
    # 计算目标像素数
    target_pixels = width * height
    
    # 确定是否需要调整尺寸
    if min_pixels > 0 and target_pixels < min_pixels:
        # 需要调整尺寸以满足最小像素要求
        need_resize = True
        # 计算需要的放大倍数
        scale_factor = math.sqrt(min_pixels / target_pixels)
        # 向上取整到最接近的32的倍数（许多模型要求尺寸是32的倍数）
        generate_width = math.ceil(width * scale_factor / 32) * 32
        generate_height = math.ceil(height * scale_factor / 32) * 32
    else:
        # 不需要调整尺寸
        need_resize = False
        generate_width = width
        generate_height = height
    
    # 返回结果
    return {
        "generate_width": generate_width,
        "generate_height": generate_height,
        "need_resize": need_resize,
        "target_width": width,
        "target_height": height,
        "aspect_ratio_type": aspect_ratio_type
    }
