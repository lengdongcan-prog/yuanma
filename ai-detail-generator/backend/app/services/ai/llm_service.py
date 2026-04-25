# 尝试导入 litellm，如果失败则使用模拟数据
try:
    import litellm
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

class LLMService:
    def __init__(self, model_id, api_key=None, api_base=None):
        if isinstance(model_id, dict):
            # 处理从数据库获取的配置
            self.model_id = model_id.get('model_id', 'default-model')
            self.api_key = model_id.get('api_key')
            self.api_base = model_id.get('api_base')
        else:
            # 处理直接传入的参数
            self.model_id = model_id
            self.api_key = api_key
            self.api_base = api_base
    
    async def generate_text(self, prompt, max_tokens=1000, temperature=0.7):
        """生成文本"""
        if not LITELLM_AVAILABLE:
            return "这是一个模拟的生成结果。在实际使用中，这里会调用真实的 LLM API。"
        
        try:
            # 配置 litellm
            if self.api_key:
                litellm.api_key = self.api_key
            if self.api_base:
                litellm.api_base = self.api_base
            
            # 调用大模型
            response = completion(
                model=self.model_id,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"LLM 调用失败: {e}")
            return "生成失败，请稍后重试"
    
    async def generate_detail_page(self, product_info, image_urls=None):
        """生成详情页"""
        if not LITELLM_AVAILABLE:
            return "<div>这是一个模拟的详情页内容</div>"
        
        try:
            # 构建提示词
            prompt = f"请为以下产品生成一个电商详情页：\n"
            prompt += f"产品名称：{product_info.get('name', '')}\n"
            prompt += f"产品描述：{product_info.get('description', '')}\n"
            prompt += f"产品特性：{product_info.get('features', '')}\n"
            prompt += f"目标平台：{product_info.get('platform', '')}\n"
            prompt += f"目标国家：{product_info.get('country', '')}\n"
            prompt += f"语言：{product_info.get('language', '')}\n"
            
            if image_urls:
                prompt += f"产品图片：{image_urls}\n"
            
            prompt += "\n请生成一个完整的详情页 HTML 代码，包括标题、描述、特性、图片展示等部分。"
            
            # 配置 litellm
            if self.api_key:
                litellm.api_key = self.api_key
            if self.api_base:
                litellm.api_base = self.api_base
            
            # 调用大模型
            response = completion(
                model=self.model_id,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2000,
                temperature=0.7
            )
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"LLM 调用失败: {e}")
            return "生成失败，请稍后重试"
    
    def generate_image(self, prompt, size="1024x1024"):
        """生成图片"""
        if not LITELLM_AVAILABLE:
            # 返回模拟图片URL
            return f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={prompt.replace(' ', '%20')}&image_size=square_hd"
        
        try:
            # 尝试导入litellm的image生成功能
            try:
                from litellm import generate_image
            except ImportError:
                # 如果没有image生成功能，返回模拟图片
                return f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={prompt.replace(' ', '%20')}&image_size=square_hd"
            
            # 配置 litellm
            if self.api_key:
                litellm.api_key = self.api_key
            if self.api_base:
                litellm.api_base = self.api_base
            
            # 调用大模型生成图片
            response = generate_image(
                model=self.model_id,
                prompt=prompt,
                size=size
            )
            
            return response.data[0].url
        except Exception as e:
            print(f"图片生成失败: {e}")
            # 失败时返回模拟图片
            return f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={prompt.replace(' ', '%20')}&image_size=square_hd"
