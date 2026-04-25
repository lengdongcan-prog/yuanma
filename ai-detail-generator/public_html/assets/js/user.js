// 历史记录存储
let historyRecords = [];
// 回收站存储
let recycleBinRecords = [];
// IndexedDB数据库实例
let db;

// 存储用户设置的提示词
let userPrompts = [];
// 配置完成状态
let configComplete = false;
// 存储生成的所有图片
let generatedImages = [];
// 存储当前长图URL
let currentLongImageUrl = null;

// 初始化IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AIDetailPageDB', 1);
        
        request.onerror = function(event) {
            console.error('IndexedDB打开失败:', event.target.error);
            // 失败时回退到localStorage
            fallbackToLocalStorage();
            resolve();
        };
        
        request.onsuccess = function(event) {
            console.log('IndexedDB打开成功');
            db = event.target.result;
            // 等待loadFromIndexedDB完成后再resolve
            loadFromIndexedDB().then(() => {
                console.log('loadFromIndexedDB完成');
                resolve();
            }).catch((error) => {
                console.error('loadFromIndexedDB失败:', error);
                resolve();
            });
        };
        
        request.onupgradeneeded = function(event) {
            console.log('IndexedDB升级');
            const db = event.target.result;
            
            // 创建历史记录表
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { keyPath: 'id' });
            }
            
            // 创建回收站表
            if (!db.objectStoreNames.contains('recycleBin')) {
                db.createObjectStore('recycleBin', { keyPath: 'id' });
            }
        };
    });
}

// 从IndexedDB加载数据
function loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            fallbackToLocalStorage();
            resolve();
            return;
        }
        
        const transaction = db.transaction(['history', 'recycleBin'], 'readonly');
        const historyStore = transaction.objectStore('history');
        const recycleBinStore = transaction.objectStore('recycleBin');
        
        const historyRequest = historyStore.getAll();
        const recycleBinRequest = recycleBinStore.getAll();
        
        let historyLoaded = false;
        let recycleBinLoaded = false;
        
        historyRequest.onsuccess = function() {
            const result = historyRequest.result || [];
            console.log('从IndexedDB加载历史记录:', result.length, '条');
            console.log('加载的历史记录详情:', JSON.stringify(result).substring(0, 500) + '...');
            
            // 修复历史记录标题并按ID降序排序（确保最新的记录在前面）
            historyRecords = result.map(record => {
                // 如果标题是"未命名产品"，但parameters中有productName，使用productName作为标题
                if (record.title === '未命名产品' && record.parameters && record.parameters.productName) {
                    return {
                        ...record,
                        title: record.parameters.productName
                    };
                }
                // 如果标题是"未命名产品"，但parameters中有coreSellingPoints，使用第一个卖点作为标题
                else if (record.title === '未命名产品' && record.parameters && record.parameters.coreSellingPoints && record.parameters.coreSellingPoints.length > 0) {
                    return {
                        ...record,
                        title: record.parameters.coreSellingPoints[0].text.substring(0, 20) + '...'
                    };
                }
                return record;
            }).sort((a, b) => b.id - a.id); // 按ID降序排序，确保最新的记录在前面
            
            console.log('修复后的历史记录数量:', historyRecords.length);
            historyLoaded = true;
            checkIfAllLoaded();
        };
        
        recycleBinRequest.onsuccess = function() {
            recycleBinRecords = recycleBinRequest.result || [];
            console.log('从IndexedDB加载回收站:', recycleBinRecords.length, '条');
            recycleBinLoaded = true;
            checkIfAllLoaded();
        };
        
        function checkIfAllLoaded() {
            if (historyLoaded && recycleBinLoaded) {
                resolve();
            }
        }
        
        transaction.onerror = function(event) {
            console.error('从IndexedDB加载失败:', event.target.error);
            fallbackToLocalStorage();
            resolve();
        };
    });
}

// 保存到IndexedDB
function saveToIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            fallbackToLocalStorage();
            resolve();
            return;
        }
        
        const transaction = db.transaction(['history', 'recycleBin'], 'readwrite');
        const historyStore = transaction.objectStore('history');
        const recycleBinStore = transaction.objectStore('recycleBin');
        
        // 清空历史记录表
        const clearHistoryRequest = historyStore.clear();
        clearHistoryRequest.onsuccess = function() {
            // 重新添加所有历史记录
            historyRecords.forEach(record => {
                historyStore.add(record);
            });
        };
        
        // 清空回收站表
        const clearRecycleBinRequest = recycleBinStore.clear();
        clearRecycleBinRequest.onsuccess = function() {
            // 重新添加所有回收站记录
            recycleBinRecords.forEach(record => {
                recycleBinStore.add(record);
            });
        };
        
        transaction.oncomplete = function() {
            console.log('保存到IndexedDB成功');
            resolve();
        };
        
        transaction.onerror = function(event) {
            console.error('保存到IndexedDB失败:', event.target.error);
            fallbackToLocalStorage();
            resolve();
        };
    });
}

// 回退到localStorage
function fallbackToLocalStorage() {
    console.log('回退到localStorage');
    try {
        const storedHistory = localStorage.getItem('ai-detail-page-history');
        const storedRecycleBin = localStorage.getItem('ai-detail-page-recycle-bin');
        historyRecords = JSON.parse(storedHistory || '[]');
        recycleBinRecords = JSON.parse(storedRecycleBin || '[]');
        console.log('从localStorage加载历史记录:', historyRecords.length, '条');
    } catch (e) {
        console.error('从localStorage加载失败:', e);
        historyRecords = [];
        recycleBinRecords = [];
    }
}

// 保存到localStorage（作为备份）
function saveToLocalStorage() {
    try {
        const historyData = JSON.stringify(historyRecords);
        const historySize = new Blob([historyData]).size;
        console.log('历史记录数据大小:', historySize, '字节');
        
        if (historySize > 4 * 1024 * 1024) {
            console.warn('历史记录数据超过4MB，可能无法保存到localStorage');
        }
        
        localStorage.setItem('ai-detail-page-history', historyData);
        localStorage.setItem('ai-detail-page-recycle-bin', JSON.stringify(recycleBinRecords));
        console.log('保存到localStorage成功');
    } catch (e) {
        console.error('保存到localStorage失败:', e);
        console.error('错误详情:', e.name, e.message);
    }
}

// 自动匹配语言
function autoMatchLanguage(country) {
    console.log('选择的国家:', country);
    const languageSelect = document.getElementById('language');
    console.log('语言选择器:', languageSelect);
    
    if (!languageSelect) {
        console.error('未找到语言选择器');
        return;
    }
    
    // 国家和语言的映射
    const countryLanguageMap = {
        'china': 'chinese',
        'usa': 'english',
        'uk': 'english',
        'korea': 'korean',
        'japan': 'japanese',
        'spain': 'spanish',
        'italy': 'italian'
    };
    
    console.log('国家语言映射:', countryLanguageMap);
    console.log('对应语言:', countryLanguageMap[country]);
    
    // 自动选择对应语言
    if (countryLanguageMap[country]) {
        languageSelect.value = countryLanguageMap[country];
        console.log('语言设置为:', languageSelect.value);
    }
}

// 图片上传处理函数
function handleImageUpload(event) {
    const files = event.target.files;
    const imagePreviews = document.getElementById('image-previews');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('只支持上传jpg/jpeg/png/web格式的图片');
            return;
        }
        
        // 验证文件大小（5MB以内）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return;
        }
        
        const reader = new FileReader();

        reader.onload = function(e) {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'preview-container';
            previewContainer.style.display = 'flex';
            previewContainer.style.alignItems = 'center';
            previewContainer.style.gap = '6px';
            previewContainer.style.marginBottom = '6px';
            previewContainer.style.padding = '6px';
            previewContainer.style.background = 'rgba(26, 32, 44, 0.8)';
            previewContainer.style.border = '1px solid rgba(100, 255, 218, 0.2)';
            previewContainer.style.borderRadius = '6px';

            // 图片序号
            const indexSpan = document.createElement('span');
            indexSpan.style.width = '16px';
            indexSpan.style.textAlign = 'center';
            indexSpan.style.color = '#64ffda';
            indexSpan.style.fontSize = '12px';
            indexSpan.textContent = imagePreviews.children.length + 1;

            // 图片预览
            const imgContainer = document.createElement('div');
            imgContainer.style.width = '40px';
            imgContainer.style.height = '40px';
            imgContainer.style.borderRadius = '4px';
            imgContainer.style.overflow = 'hidden';
            imgContainer.style.border = '1px solid rgba(100, 255, 218, 0.3)';
            imgContainer.style.position = 'relative';
            imgContainer.style.cursor = 'pointer';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            // 添加鼠标悬停放大效果
            imgContainer.addEventListener('mouseover', function() {
                // 创建图片对象获取原始尺寸
                const tempImg = new Image();
                tempImg.src = e.target.result;
                tempImg.onload = function() {
                    // 计算屏幕可用空间
                    const maxWidth = window.innerWidth * 0.8;
                    const maxHeight = window.innerHeight * 0.8;
                    let width = tempImg.width;
                    let height = tempImg.height;
                    
                    // 计算宽高比
                    const aspectRatio = width / height;
                    
                    // 根据屏幕空间调整尺寸
                    if (width > height) {
                        // 横向图片
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        }
                        // 检查高度是否超出
                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                    } else {
                        // 纵向图片或正方形
                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                        // 检查宽度是否超出
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        }
                    }
                    
                    const zoomPreview = document.createElement('div');
                    zoomPreview.className = 'zoom-preview';
                    zoomPreview.style.position = 'fixed';
                    zoomPreview.style.top = '50%';
                    zoomPreview.style.left = '50%';
                    zoomPreview.style.transform = 'translate(-50%, -50%)';
                    zoomPreview.style.width = `${width}px`;
                    zoomPreview.style.height = `${height}px`;
                    zoomPreview.style.backgroundColor = 'rgba(17, 25, 40, 0.95)';
                    zoomPreview.style.border = '1px solid rgba(100, 255, 218, 0.3)';
                    zoomPreview.style.borderRadius = '6px';
                    zoomPreview.style.padding = '20px';
                    zoomPreview.style.zIndex = '9999';
                    zoomPreview.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';

                    const zoomImg = document.createElement('img');
                    zoomImg.src = e.target.result;
                    zoomImg.style.width = '100%';
                    zoomImg.style.height = '100%';
                    zoomImg.style.objectFit = 'contain';

                    zoomPreview.appendChild(zoomImg);
                    document.body.appendChild(zoomPreview);
                };
            });

            imgContainer.addEventListener('mouseout', function() {
                const zoomPreviews = document.querySelectorAll('.zoom-preview');
                zoomPreviews.forEach(preview => preview.remove());
            });

            imgContainer.appendChild(img);

            // 图片类型选择
            const typeSelect = document.createElement('select');
            typeSelect.style.flex = '1';
            typeSelect.style.padding = '8px';
            typeSelect.style.background = 'rgba(26, 32, 44, 0.8)';
            typeSelect.style.border = '1px solid rgba(100, 255, 218, 0.3)';
            typeSelect.style.borderRadius = '6px';
            typeSelect.style.color = '#e6f1ff';
            typeSelect.style.fontSize = '14px';

            typeSelect.innerHTML = `
                <option value="main">主图</option>
                <option value="detail">细节图</option>
                <option value="selling">卖点图</option>
                <option value="parameter">参数图</option>
            `;

            // 删除按钮
            const removeBtn = document.createElement('button');
            removeBtn.style.padding = '6px 12px';
            removeBtn.style.background = 'rgba(255, 70, 70, 0.1)';
            removeBtn.style.border = '1px solid rgba(255, 70, 70, 0.3)';
            removeBtn.style.borderRadius = '6px';
            removeBtn.style.color = '#ff4646';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.transition = 'all 0.3s ease';
            removeBtn.textContent = '删除';

            removeBtn.addEventListener('click', function() {
                previewContainer.remove();
                // 更新序号
                updateImageIndices();
            });

            previewContainer.appendChild(indexSpan);
            previewContainer.appendChild(imgContainer);
            previewContainer.appendChild(typeSelect);
            previewContainer.appendChild(removeBtn);
            imagePreviews.appendChild(previewContainer);
        };

        reader.readAsDataURL(file);
    }
}

// 更新产品图片序号
function updateImageIndices() {
    const imagePreviews = document.getElementById('image-previews');
    const previews = imagePreviews.children;
    for (let i = 0; i < previews.length; i++) {
        const indexSpan = previews[i].querySelector('span');
        if (indexSpan) {
            indexSpan.textContent = i + 1;
        }
    }
}

// 穿戴图上传处理函数
function handleWearImageUpload(event) {
    const files = event.target.files;
    const wearImagePreviews = document.getElementById('wear-image-previews');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('只支持上传jpg/jpeg/png/web格式的图片');
            return;
        }
        
        // 验证文件大小（5MB以内）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return;
        }
        
        const reader = new FileReader();

        reader.onload = function(e) {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'preview-container';
            previewContainer.style.display = 'flex';
            previewContainer.style.alignItems = 'center';
            previewContainer.style.gap = '6px';
            previewContainer.style.marginBottom = '6px';
            previewContainer.style.padding = '6px';
            previewContainer.style.background = 'rgba(26, 32, 44, 0.8)';
            previewContainer.style.border = '1px solid rgba(100, 255, 218, 0.2)';
            previewContainer.style.borderRadius = '6px';

            // 图片序号
            const indexSpan = document.createElement('span');
            indexSpan.style.width = '16px';
            indexSpan.style.textAlign = 'center';
            indexSpan.style.color = '#64ffda';
            indexSpan.style.fontSize = '12px';
            indexSpan.textContent = wearImagePreviews.children.length + 1;

            // 图片预览
            const imgContainer = document.createElement('div');
            imgContainer.style.width = '40px';
            imgContainer.style.height = '40px';
            imgContainer.style.borderRadius = '4px';
            imgContainer.style.overflow = 'hidden';
            imgContainer.style.border = '1px solid rgba(100, 255, 218, 0.3)';
            imgContainer.style.position = 'relative';
            imgContainer.style.cursor = 'pointer';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            // 添加鼠标悬停放大效果
            imgContainer.addEventListener('mouseover', function() {
                // 创建图片对象获取原始尺寸
                const tempImg = new Image();
                tempImg.src = e.target.result;
                tempImg.onload = function() {
                    // 计算屏幕可用空间
                    const maxWidth = window.innerWidth * 0.8;
                    const maxHeight = window.innerHeight * 0.8;
                    let width = tempImg.width;
                    let height = tempImg.height;
                    
                    // 计算宽高比
                    const aspectRatio = width / height;
                    
                    // 根据屏幕空间调整尺寸
                    if (width > height) {
                        // 横向图片
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        }
                        // 检查高度是否超出
                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                    } else {
                        // 纵向图片或正方形
                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                        // 检查宽度是否超出
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        }
                    }
                    
                    const zoomPreview = document.createElement('div');
                    zoomPreview.className = 'zoom-preview';
                    zoomPreview.style.position = 'fixed';
                    zoomPreview.style.top = '50%';
                    zoomPreview.style.left = '50%';
                    zoomPreview.style.transform = 'translate(-50%, -50%)';
                    zoomPreview.style.width = `${width}px`;
                    zoomPreview.style.height = `${height}px`;
                    zoomPreview.style.backgroundColor = 'rgba(17, 25, 40, 0.95)';
                    zoomPreview.style.border = '1px solid rgba(100, 255, 218, 0.3)';
                    zoomPreview.style.borderRadius = '6px';
                    zoomPreview.style.padding = '20px';
                    zoomPreview.style.zIndex = '9999';
                    zoomPreview.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';

                    const zoomImg = document.createElement('img');
                    zoomImg.src = e.target.result;
                    zoomImg.style.width = '100%';
                    zoomImg.style.height = '100%';
                    zoomImg.style.objectFit = 'contain';

                    zoomPreview.appendChild(zoomImg);
                    document.body.appendChild(zoomPreview);
                };
            });

            imgContainer.addEventListener('mouseout', function() {
                const zoomPreviews = document.querySelectorAll('.zoom-preview');
                zoomPreviews.forEach(preview => preview.remove());
            });

            imgContainer.appendChild(img);

            // 删除按钮
            const removeBtn = document.createElement('button');
            removeBtn.style.padding = '6px 12px';
            removeBtn.style.background = 'rgba(255, 70, 70, 0.1)';
            removeBtn.style.border = '1px solid rgba(255, 70, 70, 0.3)';
            removeBtn.style.borderRadius = '6px';
            removeBtn.style.color = '#ff4646';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.transition = 'all 0.3s ease';
            removeBtn.textContent = '删除';

            removeBtn.addEventListener('click', function() {
                previewContainer.remove();
                // 更新序号
                updateWearImageIndices();
            });

            previewContainer.appendChild(indexSpan);
            previewContainer.appendChild(imgContainer);
            previewContainer.appendChild(removeBtn);
            wearImagePreviews.appendChild(previewContainer);
        };

        reader.readAsDataURL(file);
    }
}

// 更新穿戴图片序号
function updateWearImageIndices() {
    const wearImagePreviews = document.getElementById('wear-image-previews');
    const previews = wearImagePreviews.children;
    for (let i = 0; i < previews.length; i++) {
        const indexSpan = previews[i].querySelector('span');
        if (indexSpan) {
            indexSpan.textContent = i + 1;
        }
    }
}

// 竞品图片上传处理函数
function handleCompetitorImageUpload(event) {
    const files = event.target.files;
    const competitorImagePreviews = document.getElementById('competitor-image-previews');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('只支持上传jpg/jpeg/png/web格式的图片');
            return;
        }
        
        // 验证文件大小（5MB以内）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return;
        }
        
        const reader = new FileReader();

        reader.onload = function(e) {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'preview-container';
            previewContainer.style.display = 'flex';
            previewContainer.style.alignItems = 'center';
            previewContainer.style.gap = '6px';
            previewContainer.style.marginBottom = '6px';
            previewContainer.style.padding = '6px';
            previewContainer.style.background = 'rgba(26, 32, 44, 0.8)';
            previewContainer.style.border = '1px solid rgba(100, 255, 218, 0.2)';
            previewContainer.style.borderRadius = '6px';

            // 图片序号
            const indexSpan = document.createElement('span');
            indexSpan.style.width = '16px';
            indexSpan.style.textAlign = 'center';
            indexSpan.style.color = '#64ffda';
            indexSpan.style.fontSize = '12px';
            indexSpan.textContent = competitorImagePreviews.children.length + 1;

            // 图片预览
            const imgContainer = document.createElement('div');
            imgContainer.style.width = '40px';
            imgContainer.style.height = '40px';
            imgContainer.style.borderRadius = '4px';
            imgContainer.style.overflow = 'hidden';
            imgContainer.style.border = '1px solid rgba(100, 255, 218, 0.3)';
            imgContainer.style.position = 'relative';
            imgContainer.style.cursor = 'pointer';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            // 添加鼠标悬停放大效果
            imgContainer.addEventListener('mouseover', function() {
                // 创建图片对象获取原始尺寸
                const tempImg = new Image();
                tempImg.src = e.target.result;
                tempImg.onload = function() {
                    // 计算屏幕可用空间
                    const maxWidth = window.innerWidth * 0.8;
                    const maxHeight = window.innerHeight * 0.8;
                    let width = tempImg.width;
                    let height = tempImg.height;
                    
                    // 计算宽高比
                    const aspectRatio = width / height;
                    
                    // 根据屏幕空间调整尺寸
                    if (width > height) {
                        // 横向图片
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        }
                        // 检查高度是否超出
                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                    } else {
                        // 纵向图片或正方形
                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                        // 检查宽度是否超出
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        }
                    }
                    
                    const zoomPreview = document.createElement('div');
                    zoomPreview.className = 'zoom-preview';
                    zoomPreview.style.position = 'fixed';
                    zoomPreview.style.top = '50%';
                    zoomPreview.style.left = '50%';
                    zoomPreview.style.transform = 'translate(-50%, -50%)';
                    zoomPreview.style.width = `${width}px`;
                    zoomPreview.style.height = `${height}px`;
                    zoomPreview.style.backgroundColor = 'rgba(17, 25, 40, 0.95)';
                    zoomPreview.style.border = '1px solid rgba(100, 255, 218, 0.3)';
                    zoomPreview.style.borderRadius = '6px';
                    zoomPreview.style.padding = '20px';
                    zoomPreview.style.zIndex = '9999';
                    zoomPreview.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';

                    const zoomImg = document.createElement('img');
                    zoomImg.src = e.target.result;
                    zoomImg.style.width = '100%';
                    zoomImg.style.height = '100%';
                    zoomImg.style.objectFit = 'contain';

                    zoomPreview.appendChild(zoomImg);
                    document.body.appendChild(zoomPreview);
                };
            });

            imgContainer.addEventListener('mouseout', function() {
                const zoomPreviews = document.querySelectorAll('.zoom-preview');
                zoomPreviews.forEach(preview => preview.remove());
            });

            imgContainer.appendChild(img);

            // 删除按钮
            const removeBtn = document.createElement('button');
            removeBtn.style.padding = '6px 12px';
            removeBtn.style.background = 'rgba(255, 70, 70, 0.1)';
            removeBtn.style.border = '1px solid rgba(255, 70, 70, 0.3)';
            removeBtn.style.borderRadius = '6px';
            removeBtn.style.color = '#ff4646';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.transition = 'all 0.3s ease';
            removeBtn.textContent = '删除';

            removeBtn.addEventListener('click', function() {
                previewContainer.remove();
                // 更新序号
                updateCompetitorImageIndices();
            });

            previewContainer.appendChild(indexSpan);
            previewContainer.appendChild(imgContainer);
            previewContainer.appendChild(removeBtn);
            competitorImagePreviews.appendChild(previewContainer);
        };

        reader.readAsDataURL(file);
    }
}

// 更新竞品图片序号
function updateCompetitorImageIndices() {
    const competitorImagePreviews = document.getElementById('competitor-image-previews');
    const previews = competitorImagePreviews.children;
    for (let i = 0; i < previews.length; i++) {
        const indexSpan = previews[i].querySelector('span');
        if (indexSpan) {
            indexSpan.textContent = i + 1;
        }
    }
}

// 添加核心卖点
let sellingPointId = 0;

function addSellingPoint(text, isKey) {
    const container = document.getElementById('selling-points-container');
    const sellingPoints = container.children;
    
    if (sellingPoints.length >= 10) {
        alert('最多只能添加10条核心卖点');
        return;
    }
    
    const sellingPointDiv = document.createElement('div');
    sellingPointDiv.style.display = 'flex';
    sellingPointDiv.style.alignItems = 'center';
    sellingPointDiv.style.gap = '10px';
    sellingPointDiv.style.padding = '10px';
    sellingPointDiv.style.background = 'rgba(26, 32, 44, 0.8)';
    sellingPointDiv.style.border = '1px solid rgba(100, 255, 218, 0.2)';
    sellingPointDiv.style.borderRadius = '6px';
    sellingPointDiv.id = `selling-point-${sellingPointId}`;
    
    sellingPointDiv.innerHTML = `
        <input type="text" placeholder="输入核心卖点" value="${text || ''}" style="flex: 1; padding: 8px; background: rgba(17, 25, 40, 0.8); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 6px; color: #e6f1ff; font-size: 14px;">
        <label style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #a8b2d1;">
            <input type="checkbox" class="is-key" ${isKey ? 'checked' : ''} style="accent-color: #64ffda;">
            重点
        </label>
        <button onclick="aiRewrite(${sellingPointId})" style="padding: 6px 10px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 6px; color: #64ffda; font-size: 12px; cursor: pointer; transition: all 0.3s ease;">
            AI改写
        </button>
        <button onclick="deleteSellingPoint(${sellingPointId})" style="padding: 6px 10px; background: rgba(255, 70, 70, 0.1); border: 1px solid rgba(255, 70, 70, 0.3); border-radius: 6px; color: #ff4646; font-size: 12px; cursor: pointer; transition: all 0.3s ease;">
            删除
        </button>
    `;
    
    container.appendChild(sellingPointDiv);
    sellingPointId++;
}

// AI改写卖点
function aiRewrite(id) {
    const sellingPoint = document.getElementById(`selling-point-${id}`);
    const input = sellingPoint.querySelector('input');
    const originalText = input.value;
    
    // 模拟AI改写过程
    input.value = 'AI正在改写...';
    input.disabled = true;
    
    setTimeout(() => {
        input.value = originalText + ' (AI优化)';
        input.disabled = false;
    }, 1000);
}

// 删除卖点
function deleteSellingPoint(id) {
    const sellingPoint = document.getElementById(`selling-point-${id}`);
    if (sellingPoint) {
        sellingPoint.remove();
    }
}

// 模块数组
let modules = [];
// 拖拽的模块ID
let draggedModuleId = null;

// 添加模块
function addModule() {
    const quantity = parseInt(document.getElementById('quantity').value);
    const currentModules = document.querySelectorAll('#modules-container .module-item').length;
    
    if (currentModules >= quantity) {
        alert(`最多只能添加 ${quantity} 个模块`);
        return;
    }
    
    const moduleId = Date.now();
    const moduleNumber = currentModules + 1;
    
    const moduleHTML = `
        <div class="module-item" data-id="${moduleId}" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px; background: rgba(26, 32, 44, 0.8); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); transition: all 0.3s ease;">
            <div class="drag-icon" draggable="true" ondragstart="dragStart(event, ${moduleId})" style="font-size: 16px; color: #64ffda; cursor: grab; user-select: none; padding: 2px;">
                ⋮⋮
            </div>
            <span style="font-size: 14px; color: #e6f1ff; font-weight: 500;">模块 ${moduleNumber}</span>
            <input type="text" placeholder="输入模块内容" style="flex: 1; padding: 6px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #e6f1ff; font-size: 14px;">
            <button class="delete-module-btn" onclick="deleteModule(${moduleId})" style="padding: 4px 8px; background: #ff4757; border: none; border-radius: 50%; color: white; font-size: 12px; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                删
            </button>
        </div>
    `;
    
    document.getElementById('modules-container').insertAdjacentHTML('beforeend', moduleHTML);
    modules.push({ id: moduleId, number: moduleNumber });
    
    // 为新添加的模块添加拖拽事件
    addDragEvents();
}

// 删除模块
function deleteModule(moduleId) {
    const moduleElement = document.querySelector(`.module-item[data-id="${moduleId}"]`);
    if (moduleElement) {
        moduleElement.remove();
        modules = modules.filter(module => module.id !== moduleId);
        
        // 重新编号
        const moduleElements = document.querySelectorAll('#modules-container .module-item');
        moduleElements.forEach((element, index) => {
            const numberSpan = element.querySelector('span');
            if (numberSpan) {
                numberSpan.textContent = `模块 ${index + 1}`;
            }
        });
    }
}

// 开始拖拽
function dragStart(event, moduleId) {
    draggedModuleId = moduleId;
    // 找到对应的模块元素并设置样式
    const draggedElement = document.querySelector(`.module-item[data-id="${moduleId}"]`);
    if (draggedElement) {
        draggedElement.style.opacity = '0.7';
        draggedElement.style.transform = 'scale(1.05)';
        draggedElement.style.zIndex = '1000';
        draggedElement.style.boxShadow = '0 15px 40px rgba(100, 255, 218, 0.4)';
        draggedElement.style.transition = 'all 0.2s ease-out';
        draggedElement.style.cursor = 'grabbing';
    }
}

// 为所有模块添加拖拽事件
function addDragEvents() {
    const moduleItems = document.querySelectorAll('.module-item');
    const container = document.getElementById('modules-container');
    
    // 移除之前可能存在的指示线
    const existingIndicator = document.getElementById('drop-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // 创建放置位置指示线
    const dropIndicator = document.createElement('div');
    dropIndicator.id = 'drop-indicator';
    dropIndicator.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: #64ffda;
        border-radius: 2px;
        z-index: 999;
        display: none;
        box-shadow: 0 0 10px rgba(100, 255, 218, 0.8);
    `;
    container.appendChild(dropIndicator);
    
    moduleItems.forEach(item => {
        // 为每个模块添加dragover和drop事件
        item.addEventListener('dragover', function(event) {
            event.preventDefault();
            
            // 添加拖拽经过时的样式
            this.style.backgroundColor = 'rgba(100, 255, 218, 0.15)';
            this.style.borderColor = 'rgba(100, 255, 218, 0.7)';
            this.style.transform = 'scale(1.01)';
            this.style.transition = 'all 0.2s ease';
            
            // 确定是在目标元素之前还是之后插入
            const rect = this.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const y = event.clientY - rect.top;
            
            // 显示放置位置指示线
            dropIndicator.style.display = 'block';
            
            if (y < rect.height / 2) {
                // 在目标元素之前插入
                const top = rect.top - containerRect.top;
                dropIndicator.style.top = `${top}px`;
            } else {
                // 在目标元素之后插入
                const top = rect.bottom - containerRect.top;
                dropIndicator.style.top = `${top}px`;
            }
        });
        
        // 拖拽离开时恢复样式
        item.addEventListener('dragleave', function(event) {
            this.style.backgroundColor = 'rgba(26, 32, 44, 0.8)';
            this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            this.style.transform = 'scale(1)';
            
            // 隐藏放置位置指示线
            dropIndicator.style.display = 'none';
        });
        
        item.addEventListener('drop', function(event) {
            event.preventDefault();
            
            // 恢复目标元素的样式
            this.style.backgroundColor = 'rgba(26, 32, 44, 0.8)';
            this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            this.style.transform = 'scale(1)';
            
            // 隐藏放置位置指示线
            dropIndicator.style.display = 'none';
            
            // 恢复拖拽元素的样式
            const draggedElement = document.querySelector(`.module-item[data-id="${draggedModuleId}"]`);
            if (draggedElement) {
                draggedElement.style.opacity = '1';
                draggedElement.style.transform = 'scale(1)';
                draggedElement.style.zIndex = '1';
                draggedElement.style.boxShadow = 'none';
                draggedElement.style.cursor = 'grab';
            }
            
            // 执行模块位置交换
            if (draggedModuleId && draggedModuleId !== parseInt(this.dataset.id)) {
                const rect = this.getBoundingClientRect();
                const y = event.clientY - rect.top;
                
                if (y < rect.height / 2) {
                    // 在目标元素之前插入
                    container.insertBefore(draggedElement, this);
                } else {
                    // 在目标元素之后插入
                    container.insertBefore(draggedElement, this.nextSibling);
                }
                
                // 重新编号模块
                const moduleElements = document.querySelectorAll('#modules-container .module-item');
                moduleElements.forEach((element, index) => {
                    const numberSpan = element.querySelector('span');
                    if (numberSpan) {
                        numberSpan.textContent = `模块 ${index + 1}`;
                    }
                });
                
                // 更新modules数组
                updateModulesArray();
            }
        });
    });
}

// 开始拖拽
function dragStart(event, moduleId) {
    draggedModuleId = moduleId;
    // 找到对应的模块元素并设置样式
    const draggedElement = document.querySelector(`.module-item[data-id="${moduleId}"]`);
    if (draggedElement) {
        draggedElement.style.opacity = '0.7';
        draggedElement.style.transform = 'scale(1.05)';
        draggedElement.style.zIndex = '1000';
        draggedElement.style.boxShadow = '0 15px 40px rgba(100, 255, 218, 0.4)';
        draggedElement.style.transition = 'all 0.2s ease-out';
        draggedElement.style.cursor = 'grabbing';
    }
}

// 更新modules数组
function updateModulesArray() {
    modules = [];
    const moduleElements = document.querySelectorAll('#modules-container .module-item');
    moduleElements.forEach((element, index) => {
        const moduleId = parseInt(element.dataset.id);
        modules.push({ id: moduleId, number: index + 1 });
    });
}

// 移除模块
function removeModule(button) {
    const moduleDiv = button.closest('div');
    moduleDiv.remove();
}

// 切换竞品分析选项
function toggleAnalysisOptions() {
    const toggle = document.getElementById('analysis-toggle');
    const options = document.getElementById('analysis-options');
    options.style.display = toggle.checked ? 'block' : 'none';
}

// 分析竞品
function analyzeCompetitor() {
    const url = document.getElementById('competitor-url').value;
    if (!url) {
        alert('请输入竞品链接');
        return;
    }
    
    // 这里可以添加分析竞品的逻辑
    alert('竞品分析功能开发中');
}

// 自动分析竞品
function autoAnalyzeCompetitor() {
    // 这里可以添加自动分析竞品的逻辑
    alert('自动分析功能开发中');
}

// 确认数量
function confirmQuantity() {
    // 检查配置是否完成
    if (!configComplete) {
        alert('请先点击"配置完成"按钮，完成产品信息、策略配置和竞品分析的设置');
        return;
    }

    const quantity = parseInt(document.getElementById('quantity').value);
    if (isNaN(quantity) || quantity < 1 || quantity > 20) {
        alert('请输入有效的数量（1-20）');
        return;
    }

    // 打开提示词编辑弹窗
    openPromptModal(quantity);
}

// 打开提示词编辑弹窗
function openPromptModal(quantity) {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) {
        console.error('提示词列表容器不存在');
        return;
    }
    
    promptList.innerHTML = '';
    
    // 生成提示词输入框
    for (let i = 1; i <= quantity; i++) {
        const promptItem = document.createElement('div');
        promptItem.style.marginBottom = '15px';
        promptItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label style="font-size: 14px; color: #a8b2d1;">图片 ${i} 提示词</label>
                <button onclick="aiRewritePrompt(${i})" style="padding: 4px 10px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 4px; color: #64ffda; font-size: 12px; cursor: pointer; transition: all 0.3s ease;">AI重写</button>
            </div>
            <textarea id="prompt-${i}" style="width: 100%; padding: 10px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #e6f1ff; font-size: 14px; resize: vertical; min-height: 80px;"></textarea>
        `;
        promptList.appendChild(promptItem);
    }
    
    // 显示弹窗
    document.getElementById('prompt-modal').style.display = 'flex';
}

// 关闭提示词编辑弹窗
function closePromptModal() {
    document.getElementById('prompt-modal').style.display = 'none';
}

// 确认提示词
function confirmPrompts() {
    const quantity = parseInt(document.getElementById('quantity').value);
    if (isNaN(quantity) || quantity < 1 || quantity > 20) {
        alert('请输入有效的数量（1-20）');
        return;
    }
    
    // 收集所有提示词
    userPrompts = [];
    for (let i = 1; i <= quantity; i++) {
        const prompt = document.getElementById(`prompt-${i}`).value.trim();
        userPrompts.push(prompt);
    }
    
    // 关闭弹窗
    closePromptModal();
    
    // 提示用户提示词已保存
    alert('提示词已保存，点击\'一键生成专业详情页\'按钮开始生成图片');
}

// AI重写提示词
function aiRewritePrompt(index) {
    const promptTextarea = document.getElementById(`prompt-${index}`);
    const originalPrompt = promptTextarea.value.trim();
    
    if (!originalPrompt) {
        alert('请先输入提示词内容');
        return;
    }
    
    // 显示加载状态
    alert('正在AI重写，请稍候...');
    
    // 模拟API调用
    setTimeout(() => {
        // 模拟AI重写结果
        const rewrittenPrompt = originalPrompt + '（AI优化版）';
        promptTextarea.value = rewrittenPrompt;
        alert('AI重写完成！');
    }, 1000);
}

// 清除历史
function clearHistory() {
    if (confirm('确定要清除所有历史记录吗？')) {
        document.getElementById('history-list').innerHTML = '<div class="empty-history">暂无历史记录</div>';
    }
}

// 打开回收站
function openRecycleBin() {
    const recycleBinList = document.getElementById('recycle-bin-list');
    if (!recycleBinList) {
        console.error('回收站容器不存在');
        return;
    }
    
    if (recycleBinRecords.length === 0) {
        recycleBinList.innerHTML = '<div class="empty-history">回收站为空</div>';
    } else {
        let html = '';
        recycleBinRecords.forEach(record => {
            html += `
                <div class="history-item" data-id="${record.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="history-title">${record.title || '未命名产品'}</div>
                        <div style="display: flex; gap: 5px;">
                            <button class="restore-history-btn" onclick="restoreHistoryItem(${record.id})" style="background: none; border: none; color: #64ffda; cursor: pointer; font-size: 14px;">恢复</button>
                            <button class="delete-recycle-btn" onclick="deleteFromRecycleBin(${record.id})" style="background: none; border: none; color: #ff4646; cursor: pointer; font-size: 14px;">删除</button>
                        </div>
                    </div>
                    <div class="history-date">${new Date(record.deletedAt || record.timestamp).toLocaleString()}</div>
                    ${record.imageUrl ? `<img src="${record.imageUrl}" class="history-image">` : ''}
                </div>
            `;
        });
        recycleBinList.innerHTML = html;
    }
    
    document.getElementById('recycle-bin-modal').style.display = 'flex';
}

// 从回收站恢复历史记录
function restoreHistoryItem(id) {
    if (confirm('确定要恢复这条历史记录吗？')) {
        // 找到要恢复的记录
        const recordToRestore = recycleBinRecords.find(record => record.id === id);
        if (recordToRestore) {
            // 将记录添加回历史记录
            historyRecords.unshift({
                ...recordToRestore,
                deletedAt: undefined // 移除删除时间
            });
            
            // 从回收站中删除
            recycleBinRecords = recycleBinRecords.filter(record => record.id !== id);
            
            // 保存到IndexedDB和localStorage
            saveToIndexedDB().then(() => {
                console.log('保存到IndexedDB成功');
            }).catch((error) => {
                console.error('保存到IndexedDB失败:', error);
            });
            saveToLocalStorage();
            
            // 重新渲染历史记录和回收站
            renderHistory();
            openRecycleBin(); // 重新打开回收站以更新显示
            
            console.log('从回收站恢复历史记录:', id);
        }
    }
}

// 从回收站中删除记录
function deleteFromRecycleBin(id) {
    if (confirm('确定要永久删除这条记录吗？')) {
        // 从回收站中删除
        recycleBinRecords = recycleBinRecords.filter(record => record.id !== id);
        
        // 保存到IndexedDB和localStorage
        saveToIndexedDB().then(() => {
            console.log('保存到IndexedDB成功');
        }).catch((error) => {
            console.error('保存到IndexedDB失败:', error);
        });
        saveToLocalStorage();
        
        // 重新打开回收站以更新显示
        openRecycleBin();
        
        console.log('从回收站永久删除记录:', id);
    }
}

// 恢复所有历史记录
function restoreAllHistory() {
    if (confirm('确定要恢复所有历史记录吗？')) {
        // 将所有回收站记录添加回历史记录
        recycleBinRecords.forEach(record => {
            historyRecords.unshift({
                ...record,
                deletedAt: undefined // 移除删除时间
            });
        });
        
        // 清空回收站
        recycleBinRecords = [];
        
        // 保存到IndexedDB和localStorage
        saveToIndexedDB().then(() => {
            console.log('保存到IndexedDB成功');
        }).catch((error) => {
            console.error('保存到IndexedDB失败:', error);
        });
        saveToLocalStorage();
        
        // 重新渲染历史记录和回收站
        renderHistory();
        openRecycleBin(); // 重新打开回收站以更新显示
        
        console.log('恢复所有历史记录');
    }
}

// 清空回收站
function emptyRecycleBin() {
    if (confirm('确定要清空回收站吗？')) {
        // 清空回收站
        recycleBinRecords = [];
        
        // 保存到IndexedDB和localStorage
        saveToIndexedDB().then(() => {
            console.log('保存到IndexedDB成功');
        }).catch((error) => {
            console.error('保存到IndexedDB失败:', error);
        });
        saveToLocalStorage();
        
        // 重新打开回收站以更新显示
        openRecycleBin();
        
        console.log('清空回收站');
    }
}

// 切换语言
function switchLanguage() {
    const language = document.getElementById('preview-language').value;
    // 这里可以添加切换语言的逻辑
    alert(`切换到${language}语言`);
}

// 切换预览模式
function switchPreview(deviceType) {
    // 更新按钮样式
    if (deviceType === 'desktop') {
        document.getElementById('desktop-preview-btn').style.background = 'linear-gradient(90deg, #64ffda, #4fd1c5)';
        document.getElementById('desktop-preview-btn').style.color = '#0a192f';
        document.getElementById('mobile-preview-btn').style.background = 'rgba(100, 255, 218, 0.3)';
        document.getElementById('mobile-preview-btn').style.color = '#64ffda';
    } else if (deviceType === 'mobile') {
        document.getElementById('mobile-preview-btn').style.background = 'linear-gradient(90deg, #64ffda, #4fd1c5)';
        document.getElementById('mobile-preview-btn').style.color = '#0a192f';
        document.getElementById('desktop-preview-btn').style.background = 'rgba(100, 255, 218, 0.3)';
        document.getElementById('desktop-preview-btn').style.color = '#64ffda';
    }
    
    // 根据设备类型更新预览
    updatePreviewByDevice(deviceType);
}

// 根据设备类型更新预览
function updatePreviewByDevice(deviceType) {
    const previewContainer = document.getElementById('preview-container');
    
    // 筛选对应设备类型的图片
    const filteredImages = generatedImages.filter(image => image.type === deviceType);
    
    // 清空预览容器，重新构建
    let html = `
        <!-- 科技感动画 -->
        <div id="tech-animation" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
        <!-- 内容容器 -->
        <div class="content-container" style="width: 100%; height: 100%; overflow-y: auto; padding: 10px; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center;">
            <!-- 生成的图片 -->
            <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; width: 100%;">
    `;
    
    if (filteredImages.length === 0) {
        html += `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64ffda; text-align: center;">
                <p>没有${deviceType === 'desktop' ? '电脑端' : '手机端'}的图片</p>
            </div>
        `;
    } else {
        html += `
            <div style="width: 100%;">
                <h2 style="font-size: 18px; font-weight: 600; color: #64ffda; margin-bottom: 20px; text-align: center;">${deviceType === 'desktop' ? '电脑端' : '手机端'}详情页</h2>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 30px;">
        `;
        
        for (let i = 0; i < filteredImages.length; i++) {
            const image = filteredImages[i];
            const originalIndex = generatedImages.indexOf(image);
            const isMobile = deviceType === 'mobile';
            const maxWidth = isMobile ? '400px' : '800px';
            const aspectRatio = isMobile ? '9/16' : '16/9';
            const deviceTypeText = isMobile ? '手机端' : '电脑端';
            const objectFit = isMobile ? 'cover' : 'contain';
            
            html += `
                <div style="margin-bottom: 30px; width: 100%; max-width: ${maxWidth};">
                    <!-- 预览卡片 -->
                    <div style="background: linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(17, 24, 39, 0.9)); border-radius: 20px; padding: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.2); transition: transform 0.3s ease, box-shadow 0.3s ease;">
                        <!-- 图片容器 -->
                        <div style="position: relative; border-radius: 15px; overflow: hidden; margin-bottom: 20px; aspect-ratio: ${aspectRatio}; background: #000;">
                            <!-- 科技感边框 -->
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 15px; pointer-events: none;"></div>
                            <!-- 图片 -->
                            <img src="${image.url}" alt="生成的详情页预览" style="width: 100%; height: 100%; object-fit: ${objectFit};">
                            <!-- 科技感效果 -->
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, transparent, rgba(100, 255, 218, 0.05), transparent); pointer-events: none;"></div>
                        </div>
                        <!-- 图片信息 -->
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="font-size: 16px; font-weight: 600; color: #e6f1ff; margin: 0;">${image.name || `${deviceTypeText}详情页-${String(i+1).padStart(2, '0')}`}</h3>
                                <span style="font-size: 12px; color: rgba(100, 255, 218, 0.7);">${deviceTypeText}</span>
                            </div>
                            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                <button onclick="regenerateImage(${originalIndex})" style="padding: 8px 16px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 8px; color: #64ffda; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                                    重新生成
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    previewContainer.innerHTML = html;
    
    // 重新创建科技感动画
    createTechAnimation();
}

// 更新预览控件的显示状态
function updatePreviewControls() {
    const platform = document.getElementById('platform')?.value;
    const size = document.getElementById('size')?.value;
    
    const deviceButtons = document.getElementById('device-buttons');
    const desktopLongImageBtn = document.getElementById('desktop-long-image-btn');
    const mobileLongImageBtn = document.getElementById('mobile-long-image-btn');
    const longImagePreviewBtn = document.getElementById('long-image-preview-btn');
    
    // 检查是否满足显示条件：平台为亚马逊，尺寸为高级A+（电脑端+移动端）
    const shouldShow = platform === 'amazon' && size === 'advanced-a-plus-both';
    
    if (deviceButtons) {
        deviceButtons.style.display = shouldShow ? 'flex' : 'none';
    }
    
    if (desktopLongImageBtn) {
        desktopLongImageBtn.style.display = shouldShow ? 'block' : 'none';
    }
    
    if (mobileLongImageBtn) {
        mobileLongImageBtn.style.display = shouldShow ? 'block' : 'none';
    }
    
    if (longImagePreviewBtn) {
        longImagePreviewBtn.style.display = shouldShow ? 'none' : 'block';
    }
}

// 渲染历史记录
function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) {
        console.error('历史记录容器不存在');
        return;
    }
    
    if (historyRecords.length === 0) {
        historyList.innerHTML = '<div class="empty-history">暂无历史记录</div>';
        return;
    }
    
    let html = '';
    historyRecords.forEach(record => {
        html += `
            <div class="history-item" data-id="${record.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="history-title">${record.title || '未命名产品'}</div>
                    <button class="delete-history-btn" onclick="deleteHistoryItem(${record.id})" style="background: none; border: none; color: #ff4646; cursor: pointer; font-size: 16px; margin-left: 10px;">&times;</button>
                </div>
                <div class="history-date">${new Date(record.timestamp).toLocaleString()}</div>
                ${record.imageUrl ? `<img src="${record.imageUrl}" class="history-image">` : ''}
            </div>
        `;
    });
    
    historyList.innerHTML = html;
    
    // 添加历史记录点击事件
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', function(e) {
            // 避免点击删除按钮时触发历史记录点击事件
            if (e.target.classList.contains('delete-history-btn')) {
                return;
            }
            const id = parseInt(this.dataset.id);
            loadHistory(id);
        });
    });
}

// 删除历史记录项
function deleteHistoryItem(id) {
    if (confirm('确定要删除这条历史记录吗？')) {
        // 找到要删除的历史记录
        const recordToDelete = historyRecords.find(record => record.id === id);
        if (recordToDelete) {
            // 将记录添加到回收站
            recycleBinRecords.unshift({
                ...recordToDelete,
                deletedAt: Date.now() // 添加删除时间
            });
            
            // 从历史记录数组中删除
            historyRecords = historyRecords.filter(record => record.id !== id);
            
            // 保存到IndexedDB和localStorage
            saveToIndexedDB().then(() => {
                console.log('保存到IndexedDB成功');
            }).catch((error) => {
                console.error('保存到IndexedDB失败:', error);
            });
            saveToLocalStorage();
            
            // 重新渲染历史记录
            renderHistory();
            
            console.log('删除历史记录到回收站:', id);
        }
    }
}

// 配置完成按钮点击事件
function setupConfigCompleteButton() {
    const configCompleteBtn = document.getElementById('config-complete-btn');
    if (configCompleteBtn) {
        configCompleteBtn.addEventListener('click', function() {
            configComplete = true;
            this.innerHTML = '配置已完成 ✓';
            this.style.background = 'rgba(100, 255, 218, 0.2)';
            this.style.border = '1px solid rgba(100, 255, 218, 0.5)';
            alert('配置已完成，现在可以查看提示词并生成详情页');
        });
    }
}

// 设置事件监听器
function setupEventListeners() {
    console.log('设置事件监听器');
    
    // 生成按钮点击事件
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateDetailPage);
    }
    
    // 添加模块按钮点击事件
    const addModuleBtn = document.getElementById('add-module-btn');
    if (addModuleBtn) {
        addModuleBtn.addEventListener('click', function() {
            addModule();
        });
    }
    
    // 配置完成按钮
    setupConfigCompleteButton();
    
    // 查看提示词按钮
    const confirmQuantityBtn = document.getElementById('confirm-quantity-btn');
    if (confirmQuantityBtn) {
        confirmQuantityBtn.addEventListener('click', confirmQuantity);
    }
    
    // 关闭回收站按钮
    const closeRecycleBinBtn = document.getElementById('close-recycle-bin-btn');
    if (closeRecycleBinBtn) {
        closeRecycleBinBtn.addEventListener('click', function() {
            document.getElementById('recycle-bin-modal').style.display = 'none';
        });
    }
    
    // 恢复全部按钮
    const restoreAllBtn = document.getElementById('restore-all-btn');
    if (restoreAllBtn) {
        restoreAllBtn.addEventListener('click', restoreAllHistory);
    }
    
    // 清空回收站按钮
    const emptyRecycleBinBtn = document.getElementById('empty-recycle-bin-btn');
    if (emptyRecycleBinBtn) {
        emptyRecycleBinBtn.addEventListener('click', emptyRecycleBin);
    }
    
    // 设备预览切换
    const desktopPreviewBtn = document.getElementById('desktop-preview-btn');
    const mobilePreviewBtn = document.getElementById('mobile-preview-btn');
    if (desktopPreviewBtn && mobilePreviewBtn) {
        desktopPreviewBtn.addEventListener('click', function() {
            switchPreview('desktop');
        });
        
        mobilePreviewBtn.addEventListener('click', function() {
            switchPreview('mobile');
        });
    }
    
    // 添加平台、尺寸和高级A+选项变化的事件监听器
    const platformSelect = document.getElementById('platform');
    const sizeSelect = document.getElementById('size');
    const desktopCheckbox = document.getElementById('advanced-a-plus-pc');
    const mobileCheckbox = document.getElementById('advanced-a-plus-mobile');
    
    if (platformSelect) {
        platformSelect.addEventListener('change', updatePreviewControls);
    }
    
    if (sizeSelect) {
        sizeSelect.addEventListener('change', updatePreviewControls);
    }
    
    if (desktopCheckbox) {
        desktopCheckbox.addEventListener('change', updatePreviewControls);
    }
    
    if (mobileCheckbox) {
        mobileCheckbox.addEventListener('change', updatePreviewControls);
    }
    
    // 初始调用一次，设置初始状态
    updatePreviewControls();
    
    // 长图预览
    const longImagePreviewBtn = document.getElementById('long-image-preview-btn');
    if (longImagePreviewBtn) {
        longImagePreviewBtn.addEventListener('click', function() {
            longImagePreview();
            // 更新按钮样式
            document.getElementById('long-image-preview-btn').style.background = 'linear-gradient(90deg, #64ffda, #4fd1c5)';
            document.getElementById('long-image-preview-btn').style.color = '#0a192f';
            document.getElementById('long-image-preview-btn').style.border = 'none';
            if (document.getElementById('desktop-preview-btn')) {
                document.getElementById('desktop-preview-btn').style.background = 'rgba(100, 255, 218, 0.3)';
                document.getElementById('desktop-preview-btn').style.color = '#64ffda';
                document.getElementById('desktop-preview-btn').style.border = '1px solid #64ffda';
            }
            if (document.getElementById('mobile-preview-btn')) {
                document.getElementById('mobile-preview-btn').style.background = 'rgba(100, 255, 218, 0.3)';
                document.getElementById('mobile-preview-btn').style.color = '#64ffda';
                document.getElementById('mobile-preview-btn').style.border = '1px solid #64ffda';
            }
        });
    }
    
    // 电脑端长图
    const desktopLongImageBtn = document.getElementById('desktop-long-image-btn');
    if (desktopLongImageBtn) {
        desktopLongImageBtn.addEventListener('click', function() {
            longImagePreview('desktop');
            // 更新按钮样式
            document.getElementById('desktop-long-image-btn').style.background = 'linear-gradient(90deg, #64ffda, #4fd1c5)';
            document.getElementById('desktop-long-image-btn').style.color = '#0a192f';
            document.getElementById('desktop-long-image-btn').style.border = 'none';
            if (document.getElementById('mobile-long-image-btn')) {
                document.getElementById('mobile-long-image-btn').style.background = 'rgba(100, 255, 218, 0.3)';
                document.getElementById('mobile-long-image-btn').style.color = '#64ffda';
                document.getElementById('mobile-long-image-btn').style.border = '1px solid #64ffda';
            }
        });
    }
    
    // 手机端长图
    const mobileLongImageBtn = document.getElementById('mobile-long-image-btn');
    if (mobileLongImageBtn) {
        mobileLongImageBtn.addEventListener('click', function() {
            longImagePreview('mobile');
            // 更新按钮样式
            document.getElementById('mobile-long-image-btn').style.background = 'linear-gradient(90deg, #64ffda, #4fd1c5)';
            document.getElementById('mobile-long-image-btn').style.color = '#0a192f';
            document.getElementById('mobile-long-image-btn').style.border = 'none';
            if (document.getElementById('desktop-long-image-btn')) {
                document.getElementById('desktop-long-image-btn').style.background = 'rgba(100, 255, 218, 0.3)';
                document.getElementById('desktop-long-image-btn').style.color = '#64ffda';
                document.getElementById('desktop-long-image-btn').style.border = '1px solid #64ffda';
            }
        });
    }
    
    // 下载按钮
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            // 打开下载格式选择弹窗
            document.getElementById('download-format-modal').style.display = 'flex';
        });
    }
}

// 生成详情页
function generateDetailPage() {
    // 显示加载状态
    const previewContainer = document.getElementById('preview-container');
    
    // 显示进度条
    previewContainer.innerHTML = `
        <!-- 科技感动画 -->
        <div id="tech-animation" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
        <div class="content-container" style="width: 100%; height: 100%; overflow-y: auto; padding: 10px; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                    <p>正在生成详情页...</p>
                    <div style="width: 80%; margin: 20px auto; height: 8px; background: rgba(100, 255, 218, 0.2); border-radius: 4px; overflow: hidden;">
                        <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #64ffda, #4fd1c5); transition: width 0.3s ease;"></div>
                    </div>
                    <p id="progress-text" style="font-size: 14px; color: #64ffda; margin-top: 10px;">0%</p>
                    <p id="generation-status" style="font-size: 14px; color: #a8b2d1; margin-top: 5px;">准备生成...</p>
                </div>
            </div>
        </div>
    `;
    
    // 重新创建科技感动画
    createTechAnimation();
    
    // 获取用户设置的数量
    const quantityInput = document.getElementById('quantity');
    const quantity = Math.max(1, quantityInput ? parseInt(quantityInput.value) || 1 : 1);
    
    // 计算总时间：3秒准备时间 + 每张图片2秒生成时间
    const totalTime = 3000 + (quantity * 2000);
    const startTime = Date.now();
    
    // 更新进度条
    const progressInterval = setInterval(function() {
        const elapsedTime = Date.now() - startTime;
        let progress = Math.min((elapsedTime / totalTime) * 100, 100);
        
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        if (progressBar && progressText) {
            progressBar.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        }
        
        if (progress >= 100) {
            clearInterval(progressInterval);
        }
    }, 100);
    
    // 模拟准备过程
    setTimeout(function() {
        console.log('开始生成图片，数量:', quantity);
        
        // 清空generatedImages数组
        generatedImages = [];
        
        // 调用后端API生成图片
        generateImagesFromAPI();
        
        console.log('生成的图片数组:', generatedImages);
    }, 3000);
}

// 生成图片函数
function generateImages(index, total) {
    console.log('generateImages called with index:', index, 'total:', total);
    
    if (index >= total) {
        console.log('All images generated, calling addToHistory');
        // 所有图片生成完成
        // 添加到历史记录
        if (generatedImages.length > 0) {
            console.log('Generated images length:', generatedImages.length);
            try {
                addToHistory(generatedImages[0].url);
                console.log('addToHistory completed');
            } catch (e) {
                console.error('Error in addToHistory:', e);
            }
        }
        
        console.log('Calling updatePreview');
        try {
            updatePreview();
            console.log('updatePreview completed');
        } catch (e) {
            console.error('Error in updatePreview:', e);
        }
        return;
    }
    
    // 更新状态
    const generationStatus = document.getElementById('generation-status');
    if (generationStatus) {
        const currentImage = index + 1;
        const remainingImages = total - currentImage;
        const estimatedTime = remainingImages * 2; // 每张图片预计2秒
        generationStatus.textContent = `正在生成第 ${currentImage}/${total} 张图片，预计还需 ${estimatedTime} 秒`;
        console.log(`Generating image ${currentImage}/${total}, estimated time: ${estimatedTime}s`);
    }
    
    // 生成当前图片
    const imageUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20variation%20${index+1}&image_size=square_hd`;
    
    // 添加到数组
    generatedImages.push({
        url: imageUrl,
        name: `详情页-${String(index+1).padStart(2, '0')}`,
        type: "desktop"
    });
    console.log('Added image to generatedImages:', imageUrl);
    
    // 延迟后生成下一张图片
    console.log('Setting timeout for next image');
    setTimeout(function() {
        console.log('Timeout completed, generating next image');
        generateImages(index + 1, total);
    }, 2000); // 每张图片生成需要2秒
}

// 调用后端API生成图片
async function generateImagesFromAPI() {
    try {
        // 获取用户输入的参数
        const productName = document.getElementById('product-name').value || '未命名产品';
        const productDescription = document.getElementById('product-description').value || '';
        const platform = document.getElementById('platform').value || 'taobao';
        const size = document.getElementById('size').value || '3:4';
        const quantity = parseInt(document.getElementById('quantity').value) || 1;
        
        console.log('模拟生成图片，参数:', { platform, size, quantity });
        
        // 模拟生成图片
        generatedImages = [];
        
        if (size === 'advanced-a-plus-both') {
            // 同时生成电脑端和移动端两套图
            for (let i = 0; i < quantity; i++) {
                // 生成电脑端图片
                generatedImages.push({
                    url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20desktop%20variation%20${i+1}&image_size=landscape_4_3`,
                    name: `电脑端详情页-${String(i+1).padStart(2, '0')}`,
                    type: "desktop"
                });
                
                // 生成移动端图片
                generatedImages.push({
                    url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20mobile%20variation%20${i+1}&image_size=portrait_4_3`,
                    name: `移动端详情页-${String(i+1).padStart(2, '0')}`,
                    type: "mobile"
                });
            }
        } else {
            // 生成单套图
            for (let i = 0; i < quantity; i++) {
                generatedImages.push({
                    url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20variation%20${i+1}&image_size=square_hd`,
                    name: `详情页-${String(i+1).padStart(2, '0')}`,
                    type: "desktop"
                });
            }
        }
        
        console.log('模拟生成图片完成，图片数量:', generatedImages.length);
        
        // 更新预览
        updatePreview();
        // 添加到历史记录
        if (generatedImages.length > 0) {
            addToHistory(generatedImages[0].url);
        }
    } catch (error) {
        console.error('生成图片失败:', error);
        alert('生成图片失败，请稍后重试');
    }
}

// 轮询任务状态
async function pollTaskStatus(taskId) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/user/generate/task/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取任务状态失败');
        }
        
        const task = await response.json();
        
        if (task.status === 'completed') {
            // 任务完成，获取生成的图片
            console.log('任务完成，获取生成的图片');
            // 从task.result中获取图片URL
            generatedImages = [];
            if (task.result) {
                try {
                    const result = JSON.parse(task.result);
                    if (result.images && Array.isArray(result.images)) {
                        // 单套图的情况
                        result.images.forEach((image, index) => {
                            generatedImages.push({
                                url: image.url,
                                name: `详情页-${String(index+1).padStart(2, '0')}`,
                                type: "desktop"
                            });
                        });
                    } else if (result.desktop && result.mobile && Array.isArray(result.desktop) && Array.isArray(result.mobile)) {
                        // 两套图的情况（电脑端和移动端）
                        // 添加电脑端图片
                        result.desktop.forEach((image, index) => {
                            generatedImages.push({
                                url: image.url,
                                name: `电脑端详情页-${String(index+1).padStart(2, '0')}`,
                                type: "desktop"
                            });
                        });
                        // 添加移动端图片
                        result.mobile.forEach((image, index) => {
                            generatedImages.push({
                                url: image.url,
                                name: `移动端详情页-${String(index+1).padStart(2, '0')}`,
                                type: "mobile"
                            });
                        });
                    } else {
                        // 如果result中没有图片，使用模拟数据
                        for (let i = 0; i < 5; i++) {
                            generatedImages.push({
                                url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20variation%20${i+1}&image_size=square_hd`,
                                name: `详情页-${String(i+1).padStart(2, '0')}`,
                                type: "desktop"
                            });
                        }
                    }
                } catch (e) {
                    console.error('解析任务结果失败:', e);
                    // 解析失败时使用模拟数据
                    for (let i = 0; i < 5; i++) {
                        generatedImages.push({
                            url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20variation%20${i+1}&image_size=square_hd`,
                            name: `详情页-${String(i+1).padStart(2, '0')}`,
                            type: "desktop"
                        });
                    }
                }
            } else {
                // 如果没有result，使用模拟数据
                for (let i = 0; i < 5; i++) {
                    generatedImages.push({
                        url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20product%20detail%20page%20variation%20${i+1}&image_size=square_hd`,
                        name: `详情页-${String(i+1).padStart(2, '0')}`,
                        type: "desktop"
                    });
                }
            }
            
            // 更新预览
            updatePreview();
            // 添加到历史记录
            if (generatedImages.length > 0) {
                addToHistory(generatedImages[0].url);
            }
        } else if (task.status === 'failed') {
            throw new Error('任务执行失败');
        } else {
            // 任务仍在处理中，继续轮询
            setTimeout(() => pollTaskStatus(taskId), 2000);
        }
    } catch (error) {
        console.error('轮询任务状态失败:', error);
        alert('生成图片失败，请稍后重试');
    }
}

// 添加到历史记录
function addToHistory(imageUrl) {
    const productName = document.getElementById('product-name').value || '未命名产品';
    
    // 获取所有上传的产品图片
    const productImagePreviews = document.getElementById('image-previews');
    const productImages = [];
    if (productImagePreviews) {
        const imgElements = productImagePreviews.querySelectorAll('img');
        imgElements.forEach((img, index) => {
            productImages.push({
                url: img.src,
                type: productImagePreviews.children[index]?.querySelector('select')?.value || 'main'
            });
        });
    }
    
    // 获取所有上传的穿戴图
    const wearImagePreviews = document.getElementById('wear-image-previews');
    const wearImages = [];
    if (wearImagePreviews) {
        const imgElements = wearImagePreviews.querySelectorAll('img');
        imgElements.forEach((img) => {
            wearImages.push({
                url: img.src
            });
        });
    }
    
    // 获取核心卖点
    const coreSellingPoints = getSellingPoints();
    
    // 获取竞品链接
    const competitorUrl = document.getElementById('competitor-url')?.value || '';
    
    // 获取自定义模块
    const modules = [];
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        const moduleDivs = modulesContainer.children;
        Array.from(moduleDivs).forEach(div => {
            if (div.tagName === 'DIV') {
                const select = div.querySelector('select');
                const inputs = div.querySelectorAll('input');
                const textarea = div.querySelector('textarea');
                if (select || inputs[0] || textarea) {
                    modules.push({
                        type: select?.value || 'product-intro',
                        title: inputs[0]?.value || '',
                        content: textarea?.value || ''
                    });
                }
            }
        });
    }
    
    const historyRecord = {
        id: Date.now(),
        title: productName,
        imageUrl: imageUrl,
        timestamp: Date.now(),
        images: generatedImages.map(img => ({ url: img.url, name: img.name, type: img.type })),
        parameters: {
            productName: productName,
            productDescription: document.getElementById('product-description')?.value || '',
            platform: document.getElementById('platform')?.value || 'taobao',
            country: document.getElementById('country')?.value || 'china',
            language: document.getElementById('language')?.value || 'chinese',
            size: document.getElementById('size')?.value || '3:4',
            quantity: document.getElementById('quantity')?.value || '1',
            coreSellingPoints: coreSellingPoints,
            productImages: productImages,
            wearImages: wearImages,
            competitorUrl: competitorUrl,
            modules: modules
        }
    };
    
    // 添加到历史记录数组
    historyRecords.unshift(historyRecord);
    
    // 保存到IndexedDB和localStorage
    saveToIndexedDB().then(() => {
        console.log('保存到IndexedDB成功');
    }).catch((error) => {
        console.error('保存到IndexedDB失败:', error);
    });
    saveToLocalStorage();
    
    // 重新渲染历史记录
    renderHistory();
    
    console.log('添加到历史记录:', historyRecord);
}

// 获取核心卖点
function getSellingPoints() {
    const coreSellingPoints = [];
    const sellingPointsContainer = document.getElementById('selling-points-container');
    if (sellingPointsContainer) {
        const sellingPointDivs = sellingPointsContainer.querySelectorAll('div');
        sellingPointDivs.forEach(div => {
            const input = div.querySelector('input');
            if (input && input.value.trim()) {
                const isKey = div.querySelector('input[type="checkbox"]')?.checked || false;
                coreSellingPoints.push({
                    text: input.value.trim(),
                    isKey: isKey
                });
            }
        });
    }
    return coreSellingPoints;
}

// 加载历史记录
function loadHistory(id) {
    const historyItem = historyRecords.find(record => record.id === id);
    if (!historyItem) {
        console.error('未找到历史记录:', id);
        return;
    }
    
    const params = historyItem.parameters;
    
    // 恢复产品信息
    if (params.productName) {
        document.getElementById('product-name').value = params.productName;
    }
    if (params.productDescription) {
        document.getElementById('product-description').value = params.productDescription;
    }
    
    // 恢复平台和国家
    if (params.platform) {
        document.getElementById('platform').value = params.platform;
        autoMatchLanguage(params.country);
    }
    if (params.country) {
        document.getElementById('country').value = params.country;
    }
    if (params.language) {
        document.getElementById('language').value = params.language;
    }
    if (params.size) {
        document.getElementById('size').value = params.size;
    }
    if (params.quantity) {
        document.getElementById('quantity').value = params.quantity;
    }
    
    // 恢复核心卖点
    const sellingPointsContainer = document.getElementById('selling-points-container');
    if (sellingPointsContainer && params.coreSellingPoints) {
        sellingPointsContainer.innerHTML = '';
        params.coreSellingPoints.forEach(sp => {
            addSellingPoint(sp.text, sp.isKey);
        });
    }
    
    // 恢复产品图片
    const imagePreviews = document.getElementById('image-previews');
    if (imagePreviews && params.productImages) {
        imagePreviews.innerHTML = '';
        params.productImages.forEach(img => {
            // 创建图片预览元素
            const previewContainer = document.createElement('div');
            previewContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 6px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(100, 255, 218, 0.2); border-radius: 6px;';
            
            const indexSpan = document.createElement('span');
            indexSpan.style.cssText = 'width: 16px; text-align: center; color: #64ffda; font-size: 12px;';
            indexSpan.textContent = imagePreviews.children.length + 1;
            
            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'width: 40px; height: 40px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(100, 255, 218, 0.3);';
            
            const imgElement = document.createElement('img');
            imgElement.src = img.url;
            imgElement.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            
            imgContainer.appendChild(imgElement);
            
            const typeSelect = document.createElement('select');
            typeSelect.style.cssText = 'flex: 1; padding: 8px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 6px; color: #e6f1ff; font-size: 14px;';
            typeSelect.innerHTML = `
                <option value="main" ${img.type === 'main' ? 'selected' : ''}>主图</option>
                <option value="detail" ${img.type === 'detail' ? 'selected' : ''}>细节图</option>
                <option value="selling" ${img.type === 'selling' ? 'selected' : ''}>卖点图</option>
                <option value="parameter" ${img.type === 'parameter' ? 'selected' : ''}>参数图</option>
            `;
            
            const removeBtn = document.createElement('button');
            removeBtn.style.cssText = 'padding: 6px 12px; background: rgba(255, 70, 70, 0.1); border: 1px solid rgba(255, 70, 70, 0.3); border-radius: 6px; color: #ff4646; font-size: 12px; cursor: pointer;';
            removeBtn.textContent = '删除';
            removeBtn.onclick = function() {
                previewContainer.remove();
                updateImageIndices();
            };
            
            previewContainer.appendChild(indexSpan);
            previewContainer.appendChild(imgContainer);
            previewContainer.appendChild(typeSelect);
            previewContainer.appendChild(removeBtn);
            imagePreviews.appendChild(previewContainer);
        });
    }
    
    // 恢复穿戴图
    const wearImagePreviews = document.getElementById('wear-image-previews');
    if (wearImagePreviews && params.wearImages) {
        wearImagePreviews.innerHTML = '';
        params.wearImages.forEach(img => {
            const previewContainer = document.createElement('div');
            previewContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 6px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(100, 255, 218, 0.2); border-radius: 6px;';
            
            const indexSpan = document.createElement('span');
            indexSpan.style.cssText = 'width: 16px; text-align: center; color: #64ffda; font-size: 12px;';
            indexSpan.textContent = wearImagePreviews.children.length + 1;
            
            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'width: 40px; height: 40px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(100, 255, 218, 0.3);';
            
            const imgElement = document.createElement('img');
            imgElement.src = img.url;
            imgElement.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            
            imgContainer.appendChild(imgElement);
            
            const removeBtn = document.createElement('button');
            removeBtn.style.cssText = 'padding: 6px 12px; background: rgba(255, 70, 70, 0.1); border: 1px solid rgba(255, 70, 70, 0.3); border-radius: 6px; color: #ff4646; font-size: 12px; cursor: pointer;';
            removeBtn.textContent = '删除';
            removeBtn.onclick = function() {
                previewContainer.remove();
                updateWearImageIndices();
            };
            
            previewContainer.appendChild(indexSpan);
            previewContainer.appendChild(imgContainer);
            previewContainer.appendChild(removeBtn);
            wearImagePreviews.appendChild(previewContainer);
        });
    }
    
    // 恢复竞品链接
    if (params.competitorUrl) {
        document.getElementById('competitor-url').value = params.competitorUrl;
    }
    
    // 恢复自定义模块
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer && params.modules) {
        modulesContainer.innerHTML = '';
        params.modules.forEach(module => {
            const moduleDiv = document.createElement('div');
            moduleDiv.style.cssText = 'padding: 10px; background: rgba(26, 32, 44, 0.8); border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(255, 255, 255, 0.1);';
            
            moduleDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <select style="flex: 1; padding: 8px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #e6f1ff; font-size: 14px;">
                        <option value="product-intro" ${module.type === 'product-intro' ? 'selected' : ''}>产品介绍</option>
                        <option value="features" ${module.type === 'features' ? 'selected' : ''}>产品特点</option>
                        <option value="specs" ${module.type === 'specs' ? 'selected' : ''}>规格参数</option>
                        <option value="usage" ${module.type === 'usage' ? 'selected' : ''}>使用说明</option>
                        <option value="faq" ${module.type === 'faq' ? 'selected' : ''}>常见问题</option>
                    </select>
                    <button onclick="removeModule(this)" style="background: none; border: none; color: #ff4646; cursor: pointer; font-size: 16px;">&times;</button>
                </div>
                <div style="margin-bottom: 10px;">
                    <input type="text" placeholder="模块标题" value="${module.title || ''}" style="width: 100%; padding: 8px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #e6f1ff; font-size: 14px;">
                </div>
                <div>
                    <textarea placeholder="模块内容" style="width: 100%; padding: 8px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #e6f1ff; font-size: 14px; resize: vertical; min-height: 80px;">${module.content || ''}</textarea>
                </div>
            `;
            
            modulesContainer.appendChild(moduleDiv);
        });
    }
    
    // 恢复生成的图片
    generatedImages = historyItem.images || [];
    if (historyItem.imageUrl && generatedImages.length === 0) {
        // 兼容旧格式，只有当images数组为空时才使用imageUrl
        generatedImages = [{
            url: historyItem.imageUrl,
            name: historyItem.title || '未命名产品',
            type: 'desktop'
        }];
    }
    
    // 更新预览
    updatePreview();
    
    console.log('加载历史记录完成:', historyItem);
}

// 重新生成图片
function regenerateImage(index) {
    // 创建重新生成弹窗
    const modal = document.createElement('div');
    modal.id = 'regenerate-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    `;
    
    modal.innerHTML = `
        <div style="background: rgba(17, 25, 40, 0.95); border-radius: 12px; padding: 20px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto;">
            <h3 style="color: #64ffda; margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                重新生成图片
                <button onclick="document.getElementById('regenerate-modal').remove()" style="background: none; border: none; color: #a8b2d1; font-size: 16px; cursor: pointer;">×</button>
            </h3>
            <div style="margin-top: 20px;">
                <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a8b2d1;">提示词</label>
                <textarea id="regenerate-prompt" style="width: 100%; padding: 10px; background: rgba(26, 32, 44, 0.8); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 6px; color: #e6f1ff; font-size: 14px; resize: vertical; min-height: 100px;"></textarea>
            </div>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button onclick="aiGeneratePrompt(${index})" style="padding: 8px 16px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 6px; color: #64ffda; font-size: 14px; cursor: pointer; transition: all 0.3s ease;">AI生成提示词</button>
            </div>
            <div style="margin-top: 20px; display: flex; justify-content: space-between;">
                <button onclick="confirmRegenerate(${index})" class="generate-btn" style="width: 48%;">提交</button>
                <button onclick="document.getElementById('regenerate-modal').remove()" class="generate-btn" style="width: 48%; background: rgba(100, 255, 218, 0.1); color: #64ffda; border: 1px solid rgba(100, 255, 218, 0.3);">取消</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// AI生成提示词
function aiGeneratePrompt(index) {
    const promptInput = document.getElementById('regenerate-prompt');
    
    // 显示加载状态
    alert('正在AI生成提示词，请稍候...');
    
    // 模拟AI生成提示词
    setTimeout(() => {
        const productName = document.getElementById('product-name').value;
        const productDescription = document.getElementById('product-description').value;
        const coreSellingPoints = getSellingPoints();
        const coreSellingPointsText = coreSellingPoints.map(sp => `${sp.isKey ? '【重点】' : ''}${sp.text}`).join(' ');
        
        const generatedPrompt = `${productName} ${productDescription} ${coreSellingPointsText} 专业产品详情页，高清细节，吸引人的布局，${index + 1} / ${generatedImages.length}`;
        promptInput.value = generatedPrompt;
        alert('AI提示词生成完成！');
    }, 1000);
}

// 确认重新生成
function confirmRegenerate(index) {
    const prompt = document.getElementById('regenerate-prompt').value;
    
    if (!prompt) {
        alert('请输入提示词');
        return;
    }
    
    // 先关闭弹窗
    const modal = document.getElementById('regenerate-modal');
    if (modal) {
        modal.remove();
    }
    
    // 显示加载状态和进度条
    const previewContainer = document.getElementById('preview-container');
    const originalContent = previewContainer.innerHTML;
    const imageName = `详情页_${String(index+1).padStart(2, '0')}`;
    previewContainer.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
            <!-- 科技感动画 -->
            <div id="tech-animation" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
            <!-- 加载内容 -->
            <div style="text-align: center; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;">
                <div style="width: 80px; height: 80px; border: 4px solid #64ffda; border-top: 4px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <h3 style="font-size: 24px; color: #64ffda; margin-bottom: 20px; margin: 0; padding: 0;">${imageName} 正在生成中</h3>
                <div style="width: 300px; height: 10px; background: rgba(26, 32, 44, 0.8); border-radius: 5px; overflow: hidden; margin: 20px 0;">
                    <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #64ffda, #4fd1c5); transition: width 0.3s ease;"></div>
                </div>
                <p style="font-size: 14px; color: #a8b2d1; margin: 10px 0 0 0;">请稍等，图片正在生成...</p>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    // 创建科技感动画
    createTechAnimation();
    
    // 模拟进度条
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 100) {
            clearInterval(progressInterval);
        } else {
            const progressBar = document.getElementById('progress-bar');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }
    }, 100);
    
    // 模拟API调用
    setTimeout(() => {
        // 生成新的图片URL
        const imageUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=portrait_4_3`;
        
        // 更新generatedImages数组，保留原来的type属性
        generatedImages[index] = {
            url: imageUrl,
            name: `详情页-${String(index+1).padStart(2, '0')}`,
            type: generatedImages[index].type || "desktop"
        };
        
        // 更新预览
        updatePreview();
        
        // 提示用户重新生成完成
        alert('图片生成成功！');
    }, 2000);
}

// 获取核心卖点
function getSellingPoints() {
    const sellingPoints = [];
    const sellingPointsContainer = document.getElementById('selling-points-container');
    if (sellingPointsContainer) {
        const inputs = sellingPointsContainer.querySelectorAll('input[type="text"]');
        inputs.forEach((input, index) => {
            if (input.value.trim()) {
                sellingPoints.push({
                    text: input.value.trim(),
                    isKey: index === 0 // 假设第一个是重点
                });
            }
        });
    }
    return sellingPoints;
}

// 初始化预览
function updatePreview() {
    // 清除当前长图URL
    currentLongImageUrl = null;
    
    const previewContainer = document.getElementById('preview-container');
    
    // 清空预览容器，重新构建
    previewContainer.innerHTML = `
        <!-- 科技感动画 -->
        <div id="tech-animation" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
        <!-- 内容容器 -->
        <div class="content-container" style="width: 100%; height: 100%; overflow-y: auto; padding: 10px; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center;">
            ${generatedImages.length === 0 ? `
                <!-- 初始状态 -->
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64ffda; text-align: center;">
                    <p>点击左侧"一键生成专业详情页"按钮生成图片</p>
                </div>
            ` : `
                <!-- 生成的图片 -->
                <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; width: 100%;">
                    ${(() => {
                        // 分离电脑端和移动端图片
                        const desktopImages = generatedImages.filter(img => img.type === 'desktop');
                        const mobileImages = generatedImages.filter(img => img.type === 'mobile');
                        
                        let html = '';
                        
                        // 显示电脑端图片
                        if (desktopImages.length > 0) {
                            html += `
                                <div style="width: 100%; margin-bottom: 40px;">
                                    <h2 style="font-size: 18px; font-weight: 600; color: #64ffda; margin-bottom: 20px; text-align: center;">电脑端详情页 (1464×600)</h2>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 30px;">
                                        ${desktopImages.map((image, index) => {
                                            const originalIndex = generatedImages.indexOf(image);
                                            return `
                                                <div style="margin-bottom: 30px; width: 100%; max-width: 800px;">
                                                    <!-- 预览卡片 -->
                                                    <div style="background: linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(17, 24, 39, 0.9)); border-radius: 20px; padding: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.2); transition: transform 0.3s ease, box-shadow 0.3s ease;">
                                                        <!-- 图片容器 -->
                                                        <div style="position: relative; border-radius: 15px; overflow: hidden; margin-bottom: 20px; aspect-ratio: 16/9; background: #000;">
                                                            <!-- 科技感边框 -->
                                                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 15px; pointer-events: none;"></div>
                                                            <!-- 图片 -->
                                                            <img src="${image.url}" alt="生成的详情页预览" style="width: 100%; height: 100%; object-fit: contain;">
                                                            <!-- 科技感效果 -->
                                                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, transparent, rgba(100, 255, 218, 0.05), transparent); pointer-events: none;"></div>
                                                        </div>
                                                        <!-- 图片信息 -->
                                                        <div style="display: flex; flex-direction: column; gap: 15px;">
                                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                                <h3 style="font-size: 16px; font-weight: 600; color: #e6f1ff; margin: 0;">${image.name || `电脑端详情页-${String(index+1).padStart(2, '0')}`}</h3>
                                                                <span style="font-size: 12px; color: rgba(100, 255, 218, 0.7);">电脑端</span>
                                                            </div>
                                                            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                                                <button onclick="regenerateImage(${originalIndex})" style="padding: 8px 16px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 8px; color: #64ffda; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                                                                    重新生成
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // 显示移动端图片
                        if (mobileImages.length > 0) {
                            html += `
                                <div style="width: 100%;">
                                    <h2 style="font-size: 18px; font-weight: 600; color: #64ffda; margin-bottom: 20px; text-align: center;">移动端详情页 (600×450)</h2>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 30px;">
                                        ${mobileImages.map((image, index) => {
                                            const originalIndex = generatedImages.indexOf(image);
                                            return `
                                                <div style="margin-bottom: 30px; width: 100%; max-width: 400px;">
                                                    <!-- 预览卡片 -->
                                                    <div style="background: linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(17, 24, 39, 0.9)); border-radius: 20px; padding: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.2); transition: transform 0.3s ease, box-shadow 0.3s ease;">
                                                        <!-- 图片容器 -->
                                                        <div style="position: relative; border-radius: 15px; overflow: hidden; margin-bottom: 20px; aspect-ratio: 9/16; background: #000;">
                                                            <!-- 科技感边框 -->
                                                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 15px; pointer-events: none;"></div>
                                                            <!-- 图片 -->
                                                            <img src="${image.url}" alt="生成的详情页预览" style="width: 100%; height: 100%; object-fit: cover;">
                                                            <!-- 科技感效果 -->
                                                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, transparent, rgba(100, 255, 218, 0.05), transparent); pointer-events: none;"></div>
                                                        </div>
                                                        <!-- 图片信息 -->
                                                        <div style="display: flex; flex-direction: column; gap: 15px;">
                                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                                <h3 style="font-size: 16px; font-weight: 600; color: #e6f1ff; margin: 0;">${image.name || `移动端详情页-${String(index+1).padStart(2, '0')}`}</h3>
                                                                <span style="font-size: 12px; color: rgba(100, 255, 218, 0.7);">移动端</span>
                                                            </div>
                                                            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                                                <button onclick="regenerateImage(${originalIndex})" style="padding: 8px 16px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 8px; color: #64ffda; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                                                                    重新生成
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        return html;
                    })()}
                </div>
            `}
        </div>
    `;
    
   // 重新创建科技感动画
    createTechAnimation();
    
    // 显示/隐藏预览控件
    const previewControls = document.getElementById('preview-controls');
    if (previewControls) {
        previewControls.style.display = generatedImages.length > 0 ? 'block' : 'none';
    }
    
    // 更新预览控件的显示状态
    updatePreviewControls();
    
    console.log('初始化预览');

}

// 长图预览
function longImagePreview(deviceType) {
    // 筛选对应设备类型的图片
    const filteredImages = generatedImages.filter(image => image.type === deviceType);
    
    if (filteredImages.length === 0) {
        alert(`没有${deviceType === 'desktop' ? '电脑端' : '手机端'}的图片，无法生成长图预览`);
        return;
    }
    
    // 显示加载状态
    const previewContainer = document.getElementById('preview-container');
    
    // 保存所有现有元素
    const existingElements = Array.from(previewContainer.children);
    
    // 创建加载状态元素
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'long-image-loading';
    loadingDiv.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; z-index: 10;';
    loadingDiv.innerHTML = `
        <div style="text-align: center; z-index: 1;">
            <div style="font-size: 24px; color: #64ffda; margin-bottom: 20px; display: flex; align-items: center; justify-content: center;">
                <div style="width: 40px; height: 40px; border: 3px solid #64ffda; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>
                <span>正在生成${deviceType === 'desktop' ? '电脑端' : deviceType === 'mobile' ? '手机端' : ''}长图预览</span>
            </div>
            <p style="font-size: 14px; color: #a8b2d1;">请稍等......</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    // 隐藏所有现有元素
    existingElements.forEach(element => {
        element.style.display = 'none';
    });
    
    // 添加加载状态元素
    previewContainer.appendChild(loadingDiv);
    
    // 重新添加科技感动画
    createTechAnimation();
    
    // 生成对应设备类型的图片URL
    const imagePromises = filteredImages.map((image, index) => {
        return new Promise((resolve) => {
            // 创建对应设备类型的图片
            const placeholderCanvas = document.createElement('canvas');
            if (deviceType === 'desktop') {
                placeholderCanvas.width = 800;
                placeholderCanvas.height = 450; // 电脑端尺寸 16:9
            } else if (deviceType === 'mobile') {
                placeholderCanvas.width = 400;
                placeholderCanvas.height = 711; // 手机端尺寸 9:16
            } else {
                placeholderCanvas.width = 800;
                placeholderCanvas.height = 800;
            }
            const placeholderCtx = placeholderCanvas.getContext('2d');
            
            // 绘制背景
            placeholderCtx.fillStyle = '#f0f0f0';
            placeholderCtx.fillRect(0, 0, placeholderCanvas.width, placeholderCanvas.height);
            
            // 绘制图片信息
            placeholderCtx.fillStyle = '#333';
            placeholderCtx.font = '14px Arial';
            placeholderCtx.textAlign = 'center';
            placeholderCtx.textBaseline = 'middle';
            
            placeholderCtx.fillText('模拟图片', placeholderCanvas.width / 2, placeholderCanvas.height / 2 - 30);
            if (deviceType === 'desktop') {
                placeholderCtx.fillText('电脑端', placeholderCanvas.width / 2, placeholderCanvas.height / 2);
            } else if (deviceType === 'mobile') {
                placeholderCtx.fillText('手机端', placeholderCanvas.width / 2, placeholderCanvas.height / 2);
            }
            placeholderCtx.fillText(`图片 ${index + 1}`, placeholderCanvas.width / 2, placeholderCanvas.height / 2 + 30);
            
            resolve(placeholderCanvas);
        });
    });
    
    Promise.all(imagePromises)
        .then(images => {
            // 计算长图的宽度和高度
            const maxWidth = Math.max(...images.map(img => img.width));
            const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
            
            // 创建Canvas
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = totalHeight;
            const ctx = canvas.getContext('2d');
            
            // 绘制背景
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 拼接图片
            let currentHeight = 0;
            images.forEach(img => {
                // 计算居中位置
                const x = (maxWidth - img.width) / 2;
                ctx.drawImage(img, x, currentHeight);
                currentHeight += img.height;
            });
            
            // 转换为Data URL
            const longImageUrl = canvas.toDataURL('image/png');
            // 存储当前长图URL
            currentLongImageUrl = longImageUrl;
            
            // 移除加载状态元素
            const loadingDiv = document.getElementById('long-image-loading');
            if (loadingDiv) {
                loadingDiv.remove();
            }
            
            // 创建长图预览元素
            const longImageDiv = document.createElement('div');
            longImageDiv.id = 'long-image-preview';
            longImageDiv.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 10;';
            longImageDiv.innerHTML = `
                <!-- 科技感动画 -->
                <div id="tech-animation" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
                <div style="width: 100%; height: 100%; overflow-y: auto; padding: 20px; position: relative; z-index: 1;">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <img src="${longImageUrl}" alt="长图预览" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
                    </div>
                </div>
                <!-- 固定的按钮框 -->
                <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; z-index: 11; display: flex; gap: 10px; justify-content: center; background: rgba(17, 25, 40, 0.8); padding: 15px; border-radius: 8px; border: 1px solid rgba(100, 255, 218, 0.2);">
                    <button onclick="window.updatePreview()" style="padding: 10px 20px; background: linear-gradient(90deg, rgba(100, 255, 218, 0.1), rgba(79, 209, 197, 0.1)); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 8px; color: #64ffda; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                        返回常规预览
                    </button>
                    <button onclick="openDownloadFormatModalForLongImage()" style="padding: 10px 20px; background: linear-gradient(90deg, #64ffda, #4fd1c5); border: none; border-radius: 8px; color: #0a192f; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                        下载长图
                    </button>
                </div>
            `;
            
            // 添加长图预览元素
            previewContainer.appendChild(longImageDiv);
            
            // 隐藏预览控件
            const previewControls = document.getElementById('preview-controls');
            if (previewControls) {
                previewControls.style.display = 'none';
            }
            
            // 为长图预览创建科技感动画
            setTimeout(() => {
                const longImageAnimation = longImageDiv.querySelector('#tech-animation');
                if (longImageAnimation) {
                    // 创建Canvas元素
                    const canvas = document.createElement('canvas');
                    canvas.width = longImageAnimation.offsetWidth;
                    canvas.height = longImageAnimation.offsetHeight;
                    longImageAnimation.appendChild(canvas);
                    
                    const ctx = canvas.getContext('2d');
                    
                    // 粒子数组
                    const particles = [];
                    const gridLines = [];
                    
                    // 初始化粒子
                    for (let i = 0; i < 50; i++) {
                        particles.push({
                            x: Math.random() * canvas.width,
                            y: Math.random() * canvas.height,
                            size: Math.random() * 2 + 1,
                            speedX: (Math.random() - 0.5) * 0.5,
                            speedY: (Math.random() - 0.5) * 0.5,
                            color: `rgba(100, 255, 218, ${Math.random() * 0.5 + 0.2})`
                        });
                    }
                    
                    // 初始化网格线
                    for (let x = 0; x <= canvas.width; x += 50) {
                        gridLines.push({
                            x,
                            y1: 0,
                            y2: canvas.height,
                            opacity: Math.random() * 0.2 + 0.1
                        });
                    }
                    
                    for (let y = 0; y <= canvas.height; y += 50) {
                        gridLines.push({
                            y,
                            x1: 0,
                            x2: canvas.width,
                            opacity: Math.random() * 0.2 + 0.1
                        });
                    }
                    
                    // 动画循环
                    function animate() {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        
                        // 绘制网格
                        ctx.strokeStyle = 'rgba(100, 255, 218, 0.1)';
                        ctx.lineWidth = 0.5;
                        
                        gridLines.forEach(line => {
                            if (line.x !== undefined) {
                                ctx.beginPath();
                                ctx.moveTo(line.x, line.y1);
                                ctx.lineTo(line.x, line.y2);
                                ctx.stroke();
                            } else if (line.y !== undefined) {
                                ctx.beginPath();
                                ctx.moveTo(line.x1, line.y);
                                ctx.lineTo(line.x2, line.y);
                                ctx.stroke();
                            }
                        });
                        
                        // 绘制粒子
                        particles.forEach(particle => {
                            ctx.fillStyle = particle.color;
                            ctx.beginPath();
                            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                            ctx.fill();
                            
                            // 更新粒子位置
                            particle.x += particle.speedX;
                            particle.y += particle.speedY;
                            
                            // 边界检测
                            if (particle.x < 0) particle.x = canvas.width;
                            if (particle.x > canvas.width) particle.x = 0;
                            if (particle.y < 0) particle.y = canvas.height;
                            if (particle.y > canvas.height) particle.y = 0;
                        });
                        
                        // 绘制粒子间的连接线
                        ctx.strokeStyle = 'rgba(100, 255, 218, 0.2)';
                        ctx.lineWidth = 0.5;
                        
                        for (let i = 0; i < particles.length; i++) {
                            for (let j = i + 1; j < particles.length; j++) {
                                const dx = particles[i].x - particles[j].x;
                                const dy = particles[i].y - particles[j].y;
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                
                                if (distance < 100) {
                                    ctx.beginPath();
                                    ctx.moveTo(particles[i].x, particles[i].y);
                                    ctx.lineTo(particles[j].x, particles[j].y);
                                    ctx.stroke();
                                }
                            }
                        }
                        
                        requestAnimationFrame(animate);
                    }
                    
                    animate();
                }
            }, 100);
        })
        .catch(error => {
            console.error('生成长图失败:', error);
            
            // 移除加载状态元素
            const loadingDiv = document.getElementById('long-image-loading');
            if (loadingDiv) {
                loadingDiv.remove();
            }
            
            // 创建错误信息元素
            const errorDiv = document.createElement('div');
            errorDiv.id = 'long-image-error';
            errorDiv.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; z-index: 10;';
            errorDiv.innerHTML = `
                <div style="text-align: center; z-index: 1;">
                    <div style="font-size: 24px; color: #ff4646; margin-bottom: 20px;">生成长图失败</div>
                    <p style="font-size: 14px; color: #a8b2d1; margin-bottom: 20px;">${error.message}</p>
                    <button onclick="window.updatePreview()" style="padding: 10px 20px; background: linear-gradient(90deg, #64ffda, #4fd1c5); border: none; border-radius: 8px; color: #0a192f; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                        返回常规预览
                    </button>
                </div>
            `;
            
            // 添加错误信息元素
            previewContainer.appendChild(errorDiv);
            
            // 重新添加科技感动画
            createTechAnimation();
        });
}

// 打开长图下载格式选择弹窗
function openDownloadFormatModalForLongImage() {
    if (currentLongImageUrl) {
        document.getElementById('download-format-modal').style.display = 'flex';
    }
}

// 关闭下载格式选择弹窗
function closeDownloadFormatModal() {
    const modal = document.getElementById('download-format-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 切换水印输入框显示
function toggleWatermarkInput() {
    const addWatermark = document.getElementById('add-watermark').checked;
    const watermarkInputContainer = document.getElementById('watermark-input-container');
    watermarkInputContainer.style.display = addWatermark ? 'block' : 'none';
}

// 确认下载
function confirmDownload() {
    // 检查是否是长图下载
    if (currentLongImageUrl) {
        const format = document.getElementById('download-format').value;
        const addWatermark = document.getElementById('add-watermark').checked;
        const watermarkText = addWatermark ? document.getElementById('watermark-text').value || '水印' : '';
        
        // 下载长图
        downloadLongImage(currentLongImageUrl, format, watermarkText);
        
        // 关闭弹窗
        closeDownloadFormatModal();
        return;
    }
    
    if (generatedImages.length === 0) {
        alert('请先生成图片');
        return;
    }
    
    const format = document.getElementById('download-format').value;
    
    console.log('开始下载，格式：', format, '图片数量：', generatedImages.length);
    
    // 检查是否有JSZip库
    if (typeof JSZip === 'undefined') {
        // 如果没有JSZip，直接下载第一张图片
        const imageUrl = generatedImages[0].url;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `ai-detail-page.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        closeDownloadFormatModal();
        return;
    }
    
    // 创建JSZip实例
    const zip = new JSZip();
    
    // 添加一个简单的文本文件，用于测试压缩包是否正确生成
    zip.file('README.txt', '这是一个测试文件，用于验证压缩包是否可以正常打开。\n\n包含的图片：\n' + generatedImages.map((img, index) => `${index + 1}. ${img.name || '图片' + (index + 1)}`).join('\n'));
    
    // 处理所有图片
    const addWatermark = document.getElementById('add-watermark').checked;
    const watermarkText = addWatermark ? document.getElementById('watermark-text').value || '水印' : '';
    
    // 获取产品名称作为压缩包名字
    const productName = document.getElementById('product-name').value || '未命名产品';
    
    // 检查是否是亚马逊高级A+
    const platform = document.getElementById('platform').value;
    const size = document.getElementById('size').value;
    const isAmazonAdvancedAPlus = platform === 'amazon' && size === 'advanced-a-plus';
    
    // 为每个设备类型创建图片的函数
    function createImageForDevice(deviceType, index) {
        return new Promise((resolve, reject) => {
            console.log(`处理${deviceType === 'desktop' ? '电脑端' : '手机端'}图片 ${index + 1}`);
            
            // 创建对应设备类型的占位图片
            const placeholderCanvas = document.createElement('canvas');
            if (deviceType === 'desktop') {
                placeholderCanvas.width = 800;
                placeholderCanvas.height = 450; // 电脑端尺寸 16:9
            } else {
                placeholderCanvas.width = 400;
                placeholderCanvas.height = 711; // 手机端尺寸 9:16
            }
            const placeholderCtx = placeholderCanvas.getContext('2d');
            
            // 绘制背景
            placeholderCtx.fillStyle = '#f0f0f0';
            placeholderCtx.fillRect(0, 0, placeholderCanvas.width, placeholderCanvas.height);
            
            // 绘制图片信息
            placeholderCtx.fillStyle = '#333';
            placeholderCtx.font = '14px Arial';
            placeholderCtx.textAlign = 'center';
            placeholderCtx.textBaseline = 'middle';
            
            placeholderCtx.fillText('模拟图片', placeholderCanvas.width / 2, placeholderCanvas.height / 2 - 30);
            placeholderCtx.fillText(`${deviceType === 'desktop' ? '电脑端' : '手机端'}`, placeholderCanvas.width / 2, placeholderCanvas.height / 2);
            placeholderCtx.fillText(`图片 ${index + 1}`, placeholderCanvas.width / 2, placeholderCanvas.height / 2 + 30);
            
            // 添加水印
            if (addWatermark && watermarkText) {
                // 保存当前状态
                placeholderCtx.save();
                
                // 设置水印样式
                placeholderCtx.font = '16px Arial';
                placeholderCtx.fillStyle = 'rgba(128, 128, 128, 0.15)'; // 更淡的半透明
                placeholderCtx.textAlign = 'center';
                placeholderCtx.textBaseline = 'middle';
                
                // 旋转水印
                placeholderCtx.translate(placeholderCanvas.width / 2, placeholderCanvas.height / 2);
                placeholderCtx.rotate(-45 * Math.PI / 180);
                placeholderCtx.translate(-placeholderCanvas.width / 2, -placeholderCanvas.height / 2);
                
                // 全屏铺满水印，调整间距避免太密
                const stepX = 150; // 水平间距
                const stepY = 120; // 垂直间距
                for (let x = -stepX; x < placeholderCanvas.width + stepX; x += stepX) {
                    for (let y = -stepY; y < placeholderCanvas.height + stepY; y += stepY) {
                        placeholderCtx.fillText(watermarkText, x, y);
                    }
                }
                
                // 恢复状态
                placeholderCtx.restore();
            }
            
            // 转换为Blob
            placeholderCanvas.toBlob(function(blob) {
                if (blob) {
                    console.log(`创建${deviceType === 'desktop' ? '电脑端' : '手机端'}模拟图片 ${index + 1} 成功，大小：`, blob.size, '字节');
                    // 添加到压缩包
                    const folderName = deviceType === 'desktop' ? '电脑端详情页' : '手机端详情页';
                    // 图片命名为详情页_01、详情页_02，直到最后一张
                    const imageName = `详情页_${String(index + 1).padStart(2, '0')}`;
                    zip.file(`${folderName}/${imageName}.${format}`, blob);
                } else {
                    console.error(`创建${deviceType === 'desktop' ? '电脑端' : '手机端'}模拟图片 ${index + 1} 失败`);
                }
                resolve();
            }, `image/${format}`, 0.9);
        });
    }
    
    let promises = [];
    if (isAmazonAdvancedAPlus) {
        // 为每个图片生成电脑端和手机端两个版本
        generatedImages.forEach((image, index) => {
            promises.push(createImageForDevice('desktop', index));
            promises.push(createImageForDevice('mobile', index));
        });
    } else {
        // 常规情况，只生成一个版本
        promises = generatedImages.map((image, index) => {
            return new Promise((resolve, reject) => {
                console.log(`处理图片 ${index + 1}，URL：`, image.url);
                
                // 创建占位图片
                const placeholderCanvas = document.createElement('canvas');
                placeholderCanvas.width = 800;
                placeholderCanvas.height = 800;
                const placeholderCtx = placeholderCanvas.getContext('2d');
                
                // 绘制背景
                placeholderCtx.fillStyle = '#f0f0f0';
                placeholderCtx.fillRect(0, 0, 800, 800);
                
                // 绘制图片信息
                placeholderCtx.fillStyle = '#333';
                placeholderCtx.font = '14px Arial';
                placeholderCtx.textAlign = 'center';
                placeholderCtx.textBaseline = 'middle';
                
                placeholderCtx.fillText('模拟图片', 400, 350);
                placeholderCtx.fillText(`图片 ${index + 1}`, 400, 380);
                
                // 添加水印
                if (addWatermark && watermarkText) {
                    // 保存当前状态
                    placeholderCtx.save();
                    
                    // 设置水印样式
                    placeholderCtx.font = '20px Arial';
                    placeholderCtx.fillStyle = 'rgba(128, 128, 128, 0.15)';
                    placeholderCtx.textAlign = 'center';
                    placeholderCtx.textBaseline = 'middle';
                    
                    // 旋转水印
                    placeholderCtx.translate(400, 400);
                    placeholderCtx.rotate(-45 * Math.PI / 180);
                    placeholderCtx.translate(-400, -400);
                    
                    // 全屏铺满水印
                    const stepX = 200;
                    const stepY = 150;
                    for (let x = -stepX; x < 800 + stepX; x += stepX) {
                        for (let y = -stepY; y < 800 + stepY; y += stepY) {
                            placeholderCtx.fillText(watermarkText, x, y);
                        }
                    }
                    
                    // 恢复状态
                    placeholderCtx.restore();
                }
                
                // 转换为Blob
                placeholderCanvas.toBlob(function(blob) {
                    if (blob) {
                        console.log(`创建模拟图片 ${index + 1} 成功，大小：`, blob.size, '字节');
                        // 图片命名为详情页_01、详情页_02，直到最后一张
                        const imageName = `详情页_${String(index + 1).padStart(2, '0')}`;
                        zip.file(`${imageName}.${format}`, blob);
                    } else {
                        console.error(`创建模拟图片 ${index + 1} 失败`);
                    }
                    resolve();
                }, `image/${format}`, 0.9);
            });
        });
    }
    
    // 处理所有图片后生成压缩包
    Promise.all(promises).then(function() {
        console.log('所有图片处理完成，开始生成压缩包');
        console.log('压缩包中的文件数量：', Object.keys(zip.files).length);
        console.log('压缩包中的文件：', Object.keys(zip.files));
        
        // 确保至少有README.txt文件
        if (Object.keys(zip.files).length === 0) {
            console.log('压缩包为空，添加README.txt文件');
            zip.file('README.txt', '这是一个测试文件，用于验证压缩包是否可以正常打开。\n\n包含的图片：\n' + generatedImages.map((img, index) => `${index + 1}. ${img.name || '图片' + (index + 1)}`).join('\n'));
        }
        
        // 生成压缩包
        zip.generateAsync({ type: 'blob' }).then(function(content) {
            console.log('压缩包生成成功，大小：', content.size, '字节');
            
            // 创建下载链接，压缩包的名字是产品名称
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${productName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 释放URL对象
            setTimeout(function() {
                URL.revokeObjectURL(link.href);
            }, 100);
        }).catch(function(error) {
            console.error('生成压缩包失败：', error);
            alert('生成压缩包失败，请重试');
        });
    }).catch(function(error) {
        console.error('处理图片失败：', error);
        alert('处理图片失败，请重试');
    });
    
    // 关闭弹窗
    closeDownloadFormatModal();
}

// 下载长图
function downloadLongImage(longImageUrl, format = 'png', watermarkText = '') {
    if (!longImageUrl) return;
    
    // 创建图片对象
    const img = new Image();
    img.onload = function() {
        // 创建画布
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // 绘制图片
        ctx.drawImage(img, 0, 0);
        
        // 添加水印
        if (watermarkText) {
            ctx.save();
            ctx.fillStyle = 'rgba(128, 128, 128, 0.15)'; // 更淡的半透明
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 旋转水印（45度）
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-45 * Math.PI / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            
            // 全屏铺满水印，调整间距避免太密
            const stepX = 200; // 水平间距
            const stepY = 150; // 垂直间距
            for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
                for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
                    ctx.fillText(watermarkText, x, y);
                }
            }
            
            ctx.restore();
        }
        
        // 转换为指定格式
        let dataUrl;
        if (format === 'jpeg') {
            dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        } else {
            dataUrl = canvas.toDataURL('image/png');
        }
        
        // 创建下载链接
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `long-image.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    img.src = longImageUrl;
}

// 创建科技感动画
function createTechAnimation() {
    const techAnimation = document.getElementById('tech-animation');
    if (!techAnimation) return;
    
    // 清空现有内容
    techAnimation.innerHTML = '';
    
    // 创建Canvas元素
    const canvas = document.createElement('canvas');
    canvas.width = techAnimation.offsetWidth;
    canvas.height = techAnimation.offsetHeight;
    techAnimation.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // 粒子数组
    const particles = [];
    const gridLines = [];
    
    // 初始化粒子
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            color: `rgba(100, 255, 218, ${Math.random() * 0.5 + 0.2})`
        });
    }
    
    // 初始化网格线
    for (let x = 0; x <= canvas.width; x += 50) {
        gridLines.push({
            x,
            y1: 0,
            y2: canvas.height,
            opacity: Math.random() * 0.2 + 0.1
        });
    }
    
    for (let y = 0; y <= canvas.height; y += 50) {
        gridLines.push({
            y,
            x1: 0,
            x2: canvas.width,
            opacity: Math.random() * 0.2 + 0.1
        });
    }
    
    // 动画循环
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制网格
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.1)';
        ctx.lineWidth = 0.5;
        
        gridLines.forEach(line => {
            if (line.x !== undefined) {
                ctx.beginPath();
                ctx.moveTo(line.x, line.y1);
                ctx.lineTo(line.x, line.y2);
                ctx.stroke();
            } else if (line.y !== undefined) {
                ctx.beginPath();
                ctx.moveTo(line.x1, line.y);
                ctx.lineTo(line.x2, line.y);
                ctx.stroke();
            }
        });
        
        // 绘制粒子
        particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            
            // 更新粒子位置
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            
            // 边界检测
            if (particle.x < 0) particle.x = canvas.width;
            if (particle.x > canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = canvas.height;
            if (particle.y > canvas.height) particle.y = 0;
        });
        
        // 绘制粒子间的连接线
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.2)';
        ctx.lineWidth = 0.5;
        
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// 自定义下拉框功能
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化');
    
    // 初始化IndexedDB
    initIndexedDB().then(() => {
        console.log('IndexedDB初始化完成');
        
        // 检查历史记录加载
        console.log('页面加载 - historyRecords:', historyRecords);
        console.log('页面加载 - historyRecords长度:', historyRecords.length);
        
        // 创建科技感动画
        createTechAnimation();
        
        renderHistory();
        setupEventListeners();
        
        // 初始化预览
        updatePreview();
        
        console.log('初始化完成');
    });
    
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const sizeInput = document.getElementById('size');
    const selectedSizeText = document.getElementById('selected-size-text');
    const sizeRadios = document.querySelectorAll('input[name="size-group"]');
    const platformSelect = document.getElementById('platform');
    const amazonSizeOptions = document.getElementById('amazon-size-options');
    const generalSizeOptions = document.getElementById('general-size-options');
    const checkboxes = [];
    
    // 根据平台更新尺寸选项
    function updateSizeOptions() {
        const selectedPlatform = platformSelect.value;
        if (selectedPlatform === 'amazon') {
            // 显示亚马逊专用尺寸选项，隐藏通用尺寸选项
            amazonSizeOptions.style.display = 'block';
            generalSizeOptions.style.display = 'none';
            
            // 默认选择高级A+（电脑端+移动端）
            const defaultRadio = document.querySelector('input[name="size-group"][value="advanced-a-plus-both"]');
            if (defaultRadio) {
                defaultRadio.checked = true;
                sizeInput.value = 'advanced-a-plus-both';
                selectedSizeText.textContent = '高级A+（电脑端+移动端）';
            }
        } else {
            // 隐藏亚马逊专用尺寸选项，显示通用尺寸选项
            amazonSizeOptions.style.display = 'none';
            generalSizeOptions.style.display = 'block';
            
            // 如果当前选择的是亚马逊专用尺寸，切换到默认尺寸
            const amazonSizeValues = ['advanced-a-plus-both', '1464x600', '600x450', '970x600'];
            if (amazonSizeValues.includes(sizeInput.value)) {
                const defaultRadio = document.querySelector('input[name="size-group"][value="1:1"]');
                if (defaultRadio) {
                    defaultRadio.checked = true;
                    sizeInput.value = '1:1';
                    selectedSizeText.textContent = '1:1';
                }
            }
        }
    }
    
    // 平台选择变化时更新尺寸选项
    platformSelect.addEventListener('change', updateSizeOptions);
    
    // 初始更新尺寸选项
    updateSizeOptions();
    
    // 切换下拉菜单
    dropdownToggle.addEventListener('click', function() {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
    
    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-dropdown')) {
            dropdownMenu.style.display = 'none';
        }
    });
    
    // 处理单选按钮变化
    sizeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            sizeInput.value = this.value;
            
            // 更新显示文本
            if (this.value === 'advanced-a-plus-both') {
                selectedSizeText.textContent = '高级A+（电脑端+移动端）';
            } else if (this.value === '1464x600') {
                selectedSizeText.textContent = '高级A+ 电脑端（1464×600）';
            } else if (this.value === '600x450') {
                selectedSizeText.textContent = '高级A+ 移动端（600×450）';
            } else if (this.value === '970x600') {
                selectedSizeText.textContent = '普通A+（970×600）';
            } else if (this.value === 'custom') {
                selectedSizeText.textContent = '自定义宽高';
            } else {
                selectedSizeText.textContent = this.value;
            }
            
            // 显示/隐藏自定义尺寸容器
            const customSizeContainer = document.getElementById('custom-size-container');
            if (this.value === 'custom') {
                customSizeContainer.style.display = 'block';
            } else {
                customSizeContainer.style.display = 'none';
            }
            
            // 关闭下拉菜单
            dropdownMenu.style.display = 'none';
        });
    });
    
    // 处理复选框变化
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const selectedRadio = document.querySelector('input[name="size-group"]:checked');
            if (selectedRadio && selectedRadio.value === 'advanced-a-plus') {
                const pcChecked = document.getElementById('advanced-a-plus-pc').checked;
                const mobileChecked = document.getElementById('advanced-a-plus-mobile').checked;
                if (pcChecked && mobileChecked) {
                    selectedSizeText.textContent = '高级A+';
                } else if (pcChecked) {
                    selectedSizeText.textContent = '高级A+ (电脑端)';
                } else if (mobileChecked) {
                    selectedSizeText.textContent = '高级A+ (手机端)';
                } else {
                    selectedSizeText.textContent = '高级A+ (请选择子选项)';
                }
            }
        });
    });
});