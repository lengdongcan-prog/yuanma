// DOM 元素
const loginPage = document.getElementById('loginPage');
const adminPanel = document.getElementById('adminPanel');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminSettingsBtn = document.getElementById('adminSettingsBtn');
const adminSettingsModal = document.getElementById('adminSettingsModal');
const closeAdminSettingsBtn = document.getElementById('closeAdminSettingsBtn');
const cancelAdminSettingsBtn = document.getElementById('cancelAdminSettingsBtn');
const adminSettingsForm = document.getElementById('adminSettingsForm');
const sidebarLinks = document.querySelectorAll('.sidebar-menu-link');
const views = document.querySelectorAll('.view');
const addModelBtn = document.getElementById('addModelBtn');
const addModelModal = document.getElementById('addModelModal');
const closeAddModelBtn = document.getElementById('closeAddModelBtn');
const addModelForm = document.getElementById('addModelForm');
const modelTabs = document.querySelectorAll('.model-tab');

// 登录表单提交
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(adminLoginForm);
        const data = Object.fromEntries(formData);
        
        try {
            console.log('登录请求数据:', data);
            console.log('登录请求 URL:', window.location.origin + '/api/v1/auth/admin/login');
            
            const response = await fetch('http://127.0.0.1:8000/api/v1/auth/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            console.log('登录响应状态:', response.status);
            console.log('登录响应状态文本:', response.statusText);
            
            const responseText = await response.text();
            console.log('登录响应内容:', responseText);
            
            if (response.ok) {
                try {
                    const result = JSON.parse(responseText);
                    console.log('登录成功，获取到令牌:', result);
                    localStorage.setItem('admin_token', result.access_token);
                    loginPage.style.display = 'none';
                    adminPanel.style.display = 'flex';
                } catch (parseError) {
                    console.error('JSON 解析错误:', parseError);
                    alert('登录成功但解析响应失败，请刷新页面重试');
                }
            } else {
                console.error('登录失败:', responseText);
                alert('登录失败: ' + responseText);
            }
        } catch (error) {
            console.error('登录错误:', error);
            alert('登录失败，请重试: ' + error.message);
        }
    });
}

// 退出登录
if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        adminPanel.style.display = 'none';
        loginPage.style.display = 'flex';
    });
}

// 视图切换
if (sidebarLinks && sidebarLinks.length > 0) {
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            
            // 更新侧边栏链接状态
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // 显示对应视图
            if (views && views.length > 0) {
                views.forEach(v => v.style.display = 'none');
            }
            const viewElement = document.getElementById(`${view}View`);
            if (viewElement) {
                viewElement.style.display = 'block';
            }
        });
    });
}

// 模型标签切换
if (modelTabs && modelTabs.length > 0) {
    modelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modelTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // 切换标签页后，重新加载对应类型的模型列表
            loadModelList();
        });
    });
}

// 打开添加模型模态框
if (addModelBtn && addModelModal) {
    addModelBtn.addEventListener('click', () => {
        addModelModal.classList.add('active');
    });
}

// 关闭添加模型模态框
if (closeAddModelBtn && addModelModal) {
    closeAddModelBtn.addEventListener('click', () => {
        addModelModal.classList.remove('active');
    });
}

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
    if (addModelModal && e.target === addModelModal) {
        addModelModal.classList.remove('active');
    }
    if (adminSettingsModal && e.target === adminSettingsModal) {
        adminSettingsModal.classList.remove('active');
    }
});

// 管理员设置模态框
if (adminSettingsBtn) {
    adminSettingsBtn.addEventListener('click', () => {
        adminSettingsModal.classList.add('active');
    });
}

if (closeAdminSettingsBtn) {
    closeAdminSettingsBtn.addEventListener('click', () => {
        adminSettingsModal.classList.remove('active');
    });
}

if (cancelAdminSettingsBtn) {
    cancelAdminSettingsBtn.addEventListener('click', () => {
        adminSettingsModal.classList.remove('active');
    });
}

// 管理员设置表单提交
if (adminSettingsForm) {
    adminSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAdminSettings();
    });
}

// 添加模型表单提交
if (addModelForm) {
    addModelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addModelForm);
        const data = Object.fromEntries(formData);
        
        try {
            const token = localStorage.getItem('admin_token');
            
            // 获取当前激活的标签页，确定模型类型
            const activeTab = document.querySelector('.model-tab.active');
            let modelType = 'text_generation'; // 默认文案生成
            if (activeTab) {
                const tabId = activeTab.getAttribute('data-tab');
                if (tabId === 'image-understanding') {
                    modelType = 'image_understanding';
                } else if (tabId === 'text-generation') {
                    modelType = 'text_generation';
                } else if (tabId === 'image-generation') {
                    modelType = 'image_generation';
                }
            }
            
            // 测试连接
            console.log('开始添加模型，token:', token);
            console.log('API地址:', 'http://127.0.0.1:8000/api/v1/admin/settings/ai-models');
            console.log('模型类型:', modelType);
            
            const response = await fetch('http://127.0.0.1:8000/api/v1/admin/settings/ai-models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: data.name,
                    model_type: modelType,
                    model_id: data.model_id,
                    api_key: data.api_key,
                    api_base: data.api_base,
                    is_default: data.is_default === 'on',
                    is_enabled: data.status === 'enabled'
                })
            });
            
            console.log('添加模型响应状态:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                alert('模型添加成功！');
                addModelModal.classList.remove('active');
                addModelForm.reset();
                // 刷新模型列表
                loadModelList();
            } else {
                const error = await response.text();
                alert('添加失败: ' + error);
            }
        } catch (error) {
            console.error('添加模型错误:', error);
            alert('添加失败，请重试: ' + error.message);
        }
    });
}

// 加载模型列表
async function loadModelList() {
    try {
        const token = localStorage.getItem('admin_token');
        console.log('开始加载模型列表，token:', token);
        
        // 确保模型配置视图已经显示
        const modelsView = document.getElementById('modelsView');
        console.log('模型配置视图:', modelsView);
        console.log('模型配置视图显示状态:', modelsView ? modelsView.style.display : 'N/A');
        
        // 获取当前激活的标签页，确定要显示的模型类型
        const activeTab = document.querySelector('.model-tab.active');
        let modelType = ''; // 空字符串表示显示所有类型
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            if (tabId === 'image-understanding') {
                modelType = 'image_understanding';
            } else if (tabId === 'text-generation') {
                modelType = 'text_generation';
            } else if (tabId === 'image-generation') {
                modelType = 'image_generation';
            }
        }
        console.log('当前标签页模型类型:', modelType);
        
        const response = await fetch('http://127.0.0.1:8000/api/v1/admin/settings/ai-models', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('加载模型列表响应状态:', response.status);
        
        if (response.ok) {
            const models = await response.json();
            console.log('模型列表:', models);
            
            // 过滤模型列表，只显示当前标签页对应的模型类型
            let filteredModels = models;
            if (modelType) {
                filteredModels = models.filter(model => model.model_type === modelType);
            }
            console.log('过滤后的模型列表:', filteredModels);
            
            // 更新模型列表HTML
            const modelsTableBody = document.querySelector('#modelsView table tbody');
            console.log('模型列表表格体:', modelsTableBody);
            
            if (modelsTableBody) {
                modelsTableBody.innerHTML = '';
                
                filteredModels.forEach(model => {
                    console.log('处理模型:', model);
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${model.name}</td>
                        <td>${model.model_id}</td>
                        <td>${model.is_enabled ? '启用' : '禁用'}</td>
                        <td>${model.is_default ? '✓' : ''}</td>
                        <td>
                            <button class="btn btn-secondary" style="margin-right: 5px;" data-model-id="${model.id}">编辑</button>
                            <button class="btn btn-danger" data-model-id="${model.id}">删除</button>
                        </td>
                    `;
                    modelsTableBody.appendChild(row);
                });
                
                // 重新绑定删除和编辑事件
                bindDeleteModelEvents();
                bindEditModelEvents();
                console.log('模型列表更新完成，删除事件已绑定');
            } else {
                console.error('模型列表表格体不存在');
            }
        } else {
            const errorText = await response.text();
            console.error('加载模型列表失败:', errorText);
        }
    } catch (error) {
        console.error('加载模型列表错误:', error);
    }
}

// 测试模型连接
const testModelBtn = document.getElementById('testModelBtn');
if (testModelBtn) {
    testModelBtn.addEventListener('click', async () => {
        if (addModelForm) {
            const formData = new FormData(addModelForm);
            const data = Object.fromEntries(formData);
            
            try {
                const token = localStorage.getItem('admin_token');
                
                // 这里可以添加测试模型连接的逻辑
                alert('测试功能开发中...');
            } catch (error) {
                console.error('测试模型连接错误:', error);
                alert('测试失败，请重试: ' + error.message);
            }
        }
    });
}

// 检查登录状态
function checkAdminLogin() {
    console.log('开始检查登录状态');
    const token = localStorage.getItem('admin_token');
    console.log('token:', token);
    if (token) {
        console.log('token存在，显示管理面板');
        loginPage.style.display = 'none';
        adminPanel.style.display = 'flex';
        // 加载模型列表
        console.log('调用loadModelList');
        loadModelList();
    } else {
        console.log('token不存在，显示登录页面');
        loginPage.style.display = 'flex';
        adminPanel.style.display = 'none';
    }
}

// 绑定删除模型按钮事件
function bindDeleteModelEvents() {
    const deleteButtons = document.querySelectorAll('#modelsView .btn-danger');
    if (deleteButtons.length > 0) {
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                if (confirm('确定要删除这个模型吗？')) {
                    try {
                        const token = localStorage.getItem('admin_token');
                        // 从按钮的data-model-id属性中获取模型ID
                        const modelId = button.getAttribute('data-model-id');
                        
                        if (!modelId) {
                            alert('模型ID不存在，请刷新页面重试');
                            return;
                        }
                        
                        const response = await fetch(`http://127.0.0.1:8000/api/v1/admin/settings/ai-models/${modelId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            alert('模型删除成功！');
                            // 刷新模型列表
                            loadModelList();
                        } else {
                            const error = await response.text();
                            alert('删除失败: ' + error);
                        }
                    } catch (error) {
                        console.error('删除模型错误:', error);
                        alert('删除失败，请重试: ' + error.message);
                    }
                }
            });
        });
    }
}

// 绑定编辑模型按钮事件
function bindEditModelEvents() {
    const editButtons = document.querySelectorAll('#modelsView .btn-secondary');
    if (editButtons.length > 0) {
        editButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                // 这里可以添加编辑模型的逻辑
                alert('编辑功能开发中...');
            });
        });
    }
}

// 初始化
checkAdminLogin();

// 监听视图切换，重新绑定事件
if (sidebarLinks && sidebarLinks.length > 0) {
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            
            // 更新侧边栏链接状态
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // 显示对应视图
            if (views && views.length > 0) {
                views.forEach(v => v.style.display = 'none');
            }
            const viewElement = document.getElementById(`${view}View`);
            if (viewElement) {
                viewElement.style.display = 'block';
            }
            
            // 如果切换到模型配置视图，重新加载模型列表并绑定事件
            if (view === 'models') {
                loadModelList();
            }
        });
    });
}

// 保存管理员设置
function saveAdminSettings() {
    const username = document.getElementById('admin-username').value;
    const email = document.getElementById('admin-email').value;
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // 验证输入
    if (newPassword && newPassword !== confirmPassword) {
        alert('新密码和确认密码不一致');
        return;
    }
    
    // 构建请求数据
    const data = {
        username,
        email
    };
    
    if (currentPassword) {
        data.current_password = currentPassword;
    }
    
    if (newPassword) {
        data.new_password = newPassword;
    }
    
    try {
        const token = localStorage.getItem('admin_token');
        fetch('http://127.0.0.1:8000/api/v1/admin/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('保存失败');
            }
        })
        .then(result => {
            console.log('管理员设置保存成功:', result);
            alert('管理员设置保存成功');
            // 清空密码字段
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            // 关闭模态框
            adminSettingsModal.classList.remove('active');
        })
        .catch(error => {
            console.error('保存管理员设置错误:', error);
            alert('保存管理员设置失败，请重试: ' + error.message);
        });
    } catch (error) {
        console.error('保存管理员设置错误:', error);
        alert('保存管理员设置失败，请重试: ' + error.message);
    }
}

// 保存系统设置
function saveSystemSettings() {
    // 这里可以添加获取系统设置的逻辑
    alert('系统设置保存功能开发中');
}