import { Store } from './store.js';
import { auth } from './auth.js';
import { translations } from './translations.js';

let currentLang = localStorage.getItem('leo_lang') || 'en';

const store = new Store(() => {
    const active = document.querySelector('.nav-item.active');
    if (active) renderPage(active.getAttribute('data-page'));
});

// State
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    currentUser = auth.checkAuth();
    if (!currentUser) return; // Will redirect

    // Update Profile UI
    document.querySelector('.user-profile .name').textContent = currentUser.name;
    document.querySelector('.user-profile .role').textContent = currentUser.role;
    const avatarEl = document.querySelector('.user-profile .avatar');
    if (currentUser.profilePicture) {
        avatarEl.innerHTML = `<img src="${currentUser.profilePicture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
        avatarEl.textContent = currentUser.avatar;
    }

    // Profile Click Handler (exclude button clicks)
    document.getElementById('user-profile-section').addEventListener('click', (e) => {
        // Don't open profile modal if clicking on action buttons
        if (e.target.closest('.user-actions') || e.target.closest('button')) {
            return;
        }
        window.dispatchModal('my-profile');
    });

    // Logout Handlers
    document.querySelector('.logout-btn').addEventListener('click', () => {
        if (confirm(t('logout_confirm'))) {
            auth.logout();
        }
    });

    const switchBtn = document.getElementById('switch-account-btn');
    if (switchBtn) {
        switchBtn.addEventListener('click', () => {
            window.dispatchModal('switch-account');
        });
    }

    // Role-based UI visibility
    // Handled centrally in updateUILanguage and renderPage based on permissions

    // Mobile Sidebar Logic
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const app = document.getElementById('app');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    app.appendChild(overlay); // Append to #app so z-index works correctly

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    toggle.onclick = toggleSidebar;
    overlay.onclick = toggleSidebar;

    // Close sidebar on link click (mobile)
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) toggleSidebar();
        });
    });

    // Language Switcher
    const langSwitch = document.getElementById('lang-switch');
    if (langSwitch) {
        langSwitch.value = currentLang;
        langSwitch.addEventListener('change', (e) => {
            currentLang = e.target.value;
            localStorage.setItem('leo_lang', currentLang);
            updateUILanguage();
            renderPage(document.querySelector('.nav-item.active').getAttribute('data-page'));
        });
    }

    updateUILanguage();
    initApp();
});

function t(key) {
    return translations[currentLang][key] || key;
}

function updateUILanguage() {
    // Top Bar
    document.getElementById('quick-add-btn').innerHTML = `<i class="fa-solid fa-plus"></i>`;

    // Sidebar Permissions Check
    const pages = ['dashboard', 'stock-impact', 'stock-items', 'stock-movements', 'gallery', 'members', 'reports', 'users', 'settings'];

    pages.forEach(page => {
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!navItem) return;

        // Default constraints
        let visible = true;

        // Admin always sees everything
        if (currentUser.role === 'Admin' || currentUser.email.toLowerCase() === 'leoadmin@gmail.com') {
            visible = true;
        } else {
            // Check specific permissions if they exist, otherwise fallback to defaults
            const perms = currentUser.permissions || {};
            if (perms[page] !== undefined) {
                visible = perms[page];
            } else {
                // Default restrictions for non-admins
                if (page === 'users' || page === 'settings') visible = false;
                // Members page is visible to all users
                if (page === 'members') visible = true;
            }
        }

        navItem.style.display = visible ? 'flex' : 'none';

        // Translate labels while we are here
        const span = navItem.querySelector('span');
        if (span) span.textContent = t(page === 'stock-families' ? 'stock_families' : (page.replace('-', '_')));
    });
}

function initApp() {
    // Navigation Handling
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Stop hash jump for now, render manually
            const page = link.getAttribute('data-page');

            // Update active state
            navLinks.forEach(n => n.classList.remove('active'));
            link.classList.add('active');

            renderPage(page);
        });
    });

    // Default Page
    renderPage('dashboard');
}

function renderPage(page) {
    const content = document.getElementById('page-content');
    const title = document.getElementById('page-title');

    // Clear content
    content.innerHTML = '';
    content.className = 'content-area fade-in';

    // Global Header Button Visibility
    const quickAddBtn = document.getElementById('quick-add-btn');
    if (page === 'stock-items') {
        quickAddBtn.style.display = 'flex';
        quickAddBtn.onclick = () => window.dispatchModal('item');
    } else {
        quickAddBtn.style.display = 'none';
    }

    switch (page) {
        case 'dashboard':
            title.textContent = t('dashboard');
            renderDashboard(content);
            break;
        case 'stock-families':
            title.textContent = t('stock_families');
            renderFamilies(content);
            break;
        case 'stock-items':
            title.textContent = t('stock_items');
            renderItems(content);
            break;
        case 'stock-movements':
            title.textContent = t('stock_movements');
            renderMovements(content);
            break;
        case 'reports':
            title.textContent = t('reports');
            renderReports(content);
            break;
        case 'users':
            const hasUsersPermission = currentUser.role === 'Admin' || (currentUser.permissions && currentUser.permissions.users);
            if (!hasUsersPermission) {
                renderPage('dashboard');
                return;
            }
            title.textContent = t('users');
            renderUsers(content);
            break;
        case 'settings':
            title.textContent = t('settings');
            renderSettings(content);
            break;
        case 'stock-impact':
            title.textContent = t('stock_impact');
            renderImpactCalculator(content);
            break;
        case 'gallery':
            title.textContent = t('gallery');
            renderGallery(content);
            break;
        case 'members':
            title.textContent = t('members') || 'Members';
            renderMembers(content);
            break;
    }
}

function renderDashboard(container) {
    const stats = store.getStats();
    const familyStats = store.getFamilyStats();
    const recentMovements = store.data.movements.slice(0, 5); // Last 5

    // 1. Stats Grid
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon blue"><i class="fa-solid fa-boxes-stacked"></i></div>
            <div class="stat-value">${stats.totalItems}</div>
            <div class="stat-label">${t('total_items')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon red"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="stat-value">${stats.lowStockCount}</div>
            <div class="stat-label">${t('low_stock')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
            <div class="stat-value">${store.data.movements.length}</div>
            <div class="stat-label">${t('movements')}</div>
        </div>
        <div class="stat-card" style="cursor: pointer; transition: transform 0.2s;" onclick="renderPage('stock-items')">
            <div class="stat-icon orange"><i class="fa-solid fa-plus"></i></div>
            <div class="stat-value" style="font-size: 1.2rem;">${t('quick_add')}</div>
            <div class="stat-label">${t('manage_items')}</div>
        </div>
    `;
    container.appendChild(statsGrid);

    // 2. Split View: Family Distribution & Recent Activity
    const splitGrid = document.createElement('div');
    splitGrid.className = 'split-grid';

    // Families Card
    const famCard = document.createElement('div');
    famCard.className = 'card';
    famCard.innerHTML = `<h3><i class="fa-solid fa-chart-pie"></i> ${t('stock_by_family')}</h3>`;
    const famList = document.createElement('div');
    famList.style.marginTop = '1rem';

    familyStats.forEach(f => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.padding = '0.75rem 0';
        row.style.borderBottom = '1px solid #f1f5f9';
        row.innerHTML = `
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${f.color}"></span>
                <span>${f.name}</span>
            </div>
            <span style="font-weight:600">${f.count} items</span>
        `;
        famList.appendChild(row);
    });
    famCard.appendChild(famList);

    // Activity Card
    const movCard = document.createElement('div');
    movCard.className = 'card';
    movCard.innerHTML = `<h3><i class="fa-solid fa-history"></i> ${t('recent_movements')}</h3>`;
    const movTable = document.createElement('table');
    movTable.innerHTML = `
        <thead>
            <tr>
                <th>Type</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            ${recentMovements.map(m => `
                <tr>
                    <td>${getMovementBadge(m.type)}</td>
                    <td style="font-weight:500">${m.itemName}</td>
                    <td>${m.quantity}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted)">${m.date.split(' ')[0]}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    const tableCont = document.createElement('div');
    tableCont.className = 'table-container';
    tableCont.appendChild(movTable);
    movCard.appendChild(tableCont);

    splitGrid.appendChild(famCard);
    splitGrid.appendChild(movCard);
    container.appendChild(splitGrid);
}

function renderFamilies(container) {
    const families = store.data.families;

    const card = document.createElement('div');
    card.className = 'card';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.marginBottom = '1.5rem';
    toolbar.innerHTML = `
        <h3>${t('stock_families')}</h3>
        <button class="btn btn-primary" onclick="window.dispatchModal('family')"><i class="fa-solid fa-plus"></i> ${id ? 'Edit' : t('new_family')}</button>
    `;
    card.appendChild(toolbar);

    // Table
    const tableCont = document.createElement('div');
    tableCont.className = 'table-container';
    tableCont.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Icon</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Items Count</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${families.map(f => {
        // Calculate count for this family
        const count = store.data.items.filter(i => i.familyId === f.id).reduce((s, i) => s + i.quantity, 0);
        return `
                    <tr>
                        <td><div style="width:32px; height:32px; background:${f.color}20; color:${f.color}; display:flex; align-items:center; justify-content:center; border-radius:6px;"><i class="fa-solid ${f.icon}"></i></div></td>
                        <td style="font-weight:500">${f.name}</td>
                        <td style="color:var(--text-muted)">${f.description}</td>
                        <td>${count} units</td>
                        <td>
                            <button style="border:none; background:none; cursor:pointer; color:var(--text-muted)"><i class="fa-solid fa-pen"></i></button>
                        </td>
                    </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
    card.appendChild(tableCont);
    container.appendChild(card);
}
function renderImpactCalculator(container) {
    const families = store.data.families;

    // 1. Header & Filter Toolbar
    const welcome = document.createElement('div');
    welcome.style.marginBottom = '2rem';
    welcome.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div>
                <h3 style="font-size:1.5rem; font-weight:700;">Family Impact Calculator</h3>
                <p style="color:var(--text-muted)">Define requirements for different family types to calculate stock impact.</p>
            </div>
            <button class="btn btn-primary" onclick="window.dispatchModal('family')">
                <i class="fa-solid fa-plus"></i> New Family Type
            </button>
        </div>

        <div style="display:grid; grid-template-columns: 2fr 1.2fr 1.2fr; gap:1rem; margin-bottom:2rem;" class="split-grid">
            <div style="position:relative;">
                <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="fam-search-input" placeholder="Search by family name..." 
                       style="width:100%; padding:0.8rem 0.8rem 0.8rem 2.5rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(255,255,255,0.5); font-family:inherit;">
            </div>
            
            <select id="fam-capacity-filter" style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(255,255,255,0.5); font-family:inherit; cursor:pointer;">
                <option value="all">All Capacities</option>
                <option value="ready">Ready to Help (>0)</option>
                <option value="lacking">Stock Lacking (0)</option>
            </select>
            
            <select id="fam-item-filter" style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(255,255,255,0.5); font-family:inherit; cursor:pointer;">
                <option value="all">Any Item Requirement</option>
                ${store.data.items.map(i => `<option value="${i.id}">Requires: ${i.name}</option>`).join('')}
            </select>
        </div>
    `;
    container.appendChild(welcome);

    // 2. Grid Container
    const grid = document.createElement('div');
    grid.className = 'item-grid';
    container.appendChild(grid);

    // 3. Filter Logic
    const updateFamDisplay = () => {
        const query = document.getElementById('fam-search-input').value.toLowerCase();
        const capFilter = document.getElementById('fam-capacity-filter').value;
        const itemFilter = document.getElementById('fam-item-filter').value;

        const filtered = store.data.families.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(query) || (f.description && f.description.toLowerCase().includes(query));

            const capacity = store.getCapacityForFamily(f.id);
            let matchesCap = true;
            if (capFilter === 'ready') matchesCap = capacity > 0;
            if (capFilter === 'lacking') matchesCap = capacity === 0;

            const matchesItem = itemFilter === 'all' || (f.requirements && f.requirements.some(r => r.itemId === itemFilter));

            return matchesSearch && matchesCap && matchesItem;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:4rem; color:var(--text-muted);">
                <i class="fa-solid fa-users-slash" style="font-size:3rem; margin-bottom:1rem; opacity:0.2;"></i>
                <p>No family categories match your criteria.</p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(f => {
            const capacity = store.getCapacityForFamily(f.id);
            const reqCount = f.requirements ? f.requirements.length : 0;

            return `
            <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; gap:1.5rem; padding:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="width:48px; height:48px; background:${f.color}15; color:${f.color}; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                        <i class="fa-solid ${f.icon || 'fa-users'}"></i>
                    </div>
                    <button onclick="window.deleteFamilyCategory('${f.id}')" style="border:none; background:none; color:var(--danger); cursor:pointer; opacity:0.6;"><i class="fa-solid fa-trash"></i></button>
                </div>
                
                <div>
                    <h4 style="font-size:1.25rem; font-weight:700;">${f.name}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem; min-height:2.4em;">${f.description || 'No description'}</p>
                </div>

                <div style="background:var(--bg-body); padding:1rem; border-radius:12px; text-align:center;">
                    <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.25rem;">Current Capacity</div>
                    <div style="font-size:2rem; font-weight:800; color:${capacity > 0 ? 'var(--primary)' : 'var(--danger)'};">${capacity} Families</div>
                </div>

                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                        <span style="font-size:0.85rem; font-weight:600;">Package Requirements</span>
                        <span class="badge" style="background:rgba(0,0,0,0.05); color:var(--text-main);">${reqCount} Items</span>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:180px; overflow-y:auto; padding-right:5px;">
                        ${(f.requirements || []).map(req => {
                const item = store.data.items.find(i => i.id === req.itemId);
                if (!item) return '';
                return `
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; padding:0.5rem; background:white; border-radius:8px; border:1px solid #f1f5f9;">
                                <span>${item.name}</span>
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <input type="number" value="${req.quantity}" 
                                           onchange="window.updateRequirementValue('${f.id}', '${item.id}', this.value)"
                                           style="width:45px; border:none; background:#f8fafc; text-align:center; font-weight:700; border-radius:4px; padding:0.2rem;">
                                    <button onclick="window.updateRequirementValue('${f.id}', '${item.id}', 0)" style="border:none; background:none; color:var(--danger); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                            </div>
                            `;
            }).join('')}
                    </div>

                    <div class="form-group" style="margin-top:1rem; margin-bottom:0;">
                        <select onchange="if(this.value) window.updateRequirementValue('${f.id}', this.value, 1)" style="width:100%; padding:0.6rem; border-radius:8px; border:1px dashed var(--text-light); background:none; font-size:0.8rem; cursor:pointer;">
                            <option value="">+ Add Item to Package...</option>
                            ${store.data.items.filter(i => !f.requirements || !f.requirements.find(r => r.itemId === i.id)).map(item => `
                                <option value="${item.id}">${item.name} (${item.unit})</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <button class="btn btn-secondary" onclick="window.forecaseForCategory('${f.id}')" style="width:100%; justify-content:center; padding:0.6rem; font-size:0.85rem;">
                    <i class="fa-solid fa-chart-line"></i> Run Forecast
                </button>
            </div>
            `;
        }).join('');
    };

    // Bind Events
    document.getElementById('fam-search-input').oninput = updateFamDisplay;
    document.getElementById('fam-capacity-filter').onchange = updateFamDisplay;
    document.getElementById('fam-item-filter').onchange = updateFamDisplay;

    // Initial Execute
    updateFamDisplay();

    // --- Global Helpers ---

    window.deleteFamilyCategory = (id) => {
        if (confirm('Are you sure? All requirement data for this family type will be lost.')) {
            store.deleteFamily(id);
            renderPage('stock-impact');
        }
    };

    window.updateRequirementValue = (fId, iId, qty) => {
        store.updateFamilyRequirement(fId, iId, qty);
        renderPage('stock-impact');
    };

    window.forecaseForCategory = (fId) => {
        const count = prompt('How many families do you want to help?', '100');
        if (!count) return;

        const results = store.getNeededForTarget(fId, parseInt(count));
        const family = store.data.families.find(f => f.id === fId);

        // Show result in a simplified "Floating" modal style or just re-render
        let resultHTML = `
            <div style="margin-bottom:1.5rem; text-align:center;">
                <h4 style="font-size:1.2rem;">Forecast for ${count} "${family.name}" Families</h4>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                ${results.map(r => `
                    <div style="padding:1rem; background:#f8fafc; border-radius:12px; border-left:4px solid ${r.lack > 0 ? 'var(--danger)' : 'var(--success)'}">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                            <span style="font-weight:700;">${r.itemName}</span>
                            <span style="font-weight:700; color:${r.lack > 0 ? 'var(--danger)' : 'var(--success)'}">
                                ${r.lack > 0 ? `Lacking: ${r.lack}` : 'Ready'}
                            </span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted)">Needed: ${r.totalNeeded} | In Stock: ${r.current}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Temporarily shove it into the modal container for an easy "Full Report" view
        window.dispatchModal('raw', null, { title: 'Impact Forecast', body: resultHTML });
    };
}

function renderMovements(container) {
    const movements = store.data.movements;

    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `<h3>${t('full_history')}</h3>`;

    const tableCont = document.createElement('div');
    tableCont.className = 'table-container';
    tableCont.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th class="hide-mobile">Reason</th>
                    <th class="hide-mobile">User</th>
                </tr>
            </thead>
            <tbody>
                ${movements.map(m => `
                    <tr>
                        <td style="font-size:0.85rem">${m.date.split(' ')[0]} <span class="hide-mobile">${m.date.split(' ')[1]}</span></td>
                        <td>${getMovementBadge(m.type)}</td>
                        <td style="font-weight:500">${m.itemName}</td>
                        <td>${m.quantity}</td>
                        <td class="hide-mobile">${m.reason}</td>
                        <td class="hide-mobile" style="font-size:0.85rem; color:var(--text-muted)">${m.user}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    card.appendChild(tableCont);
    container.appendChild(card);
}

// Helpers
function formatCurrency(val) {
    return val.toLocaleString('en-US', { style: 'currency', currency: 'TND' });
}

function getMovementBadge(type) {
    if (type === 'incoming') return `<span class="badge success"><i class="fa-solid fa-arrow-down"></i> In</span>`;
    if (type === 'outgoing') return `<span class="badge danger"><i class="fa-solid fa-arrow-up"></i> Out</span>`;
    return `<span class="badge warning">Adj</span>`;
}

function renderItems(container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '1.5rem';

    // 1. Filter Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.flexDirection = 'column';
    toolbar.style.gap = '1rem';
    toolbar.style.marginBottom = '2rem';

    toolbar.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size:1.5rem; font-weight:700;">${t('stock_items')}</h3>
            <button class="btn btn-primary" onclick="window.dispatchModal('item')">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
        
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:1rem;" class="split-grid">
            <div style="position:relative;">
                <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="search-input" placeholder="Search by name or reference..." 
                       style="width:100%; padding:0.8rem 0.8rem 0.8rem 2.5rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(0,0,0,0.02); font-family:inherit;">
            </div>
            
            <select id="category-filter" style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(0,0,0,0.02); font-family:inherit; cursor:pointer;">
                <option value="all">All Categories</option>
                ${store.data.families.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
            </select>
            
            <select id="status-filter" style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(0,0,0,0.02); font-family:inherit; cursor:pointer;">
                <option value="all">All Statuses</option>
                <option value="low">Low Stock</option>
                <option value="normal">Normal Stock</option>
                <option value="out">Out of Stock</option>
            </select>
        </div>
    `;
    card.appendChild(toolbar);

    // 2. Grid Container
    const grid = document.createElement('div');
    grid.className = 'item-grid';
    card.appendChild(grid);
    container.appendChild(card);

    // 3. Filter Execution Logic
    const updateDisplay = () => {
        const query = document.getElementById('search-input').value.toLowerCase();
        const cat = document.getElementById('category-filter').value;
        const status = document.getElementById('status-filter').value;

        const filtered = store.data.items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(query) || item.ref.toLowerCase().includes(query);
            const matchesCat = cat === 'all' || item.familyId === cat;

            let matchesStatus = true;
            if (status === 'low') matchesStatus = item.quantity <= item.minQuantity && item.quantity > 0;
            if (status === 'normal') matchesStatus = item.quantity > item.minQuantity;
            if (status === 'out') matchesStatus = item.quantity <= 0;

            return matchesSearch && matchesCat && matchesStatus;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:4rem; color:var(--text-muted);">
                <i class="fa-solid fa-box-open" style="font-size:3rem; margin-bottom:1rem; opacity:0.2;"></i>
                <p>No items match your criteria.</p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(item => {
            const family = store.data.families.find(f => f.id === item.familyId) || { name: 'Unknown', color: '#666', icon: 'fa-box' };
            const isLow = item.quantity <= item.minQuantity;
            const isOut = item.quantity <= 0;
            const statusClass = isOut ? 'low' : (isLow ? 'low' : 'ok');
            const statusText = isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'Active');

            return `
            <div class="item-card">
                <div class="item-status-badge ${statusClass}">
                    ${isLow ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-check"></i>'} ${statusText}
                </div>
                
                <div class="item-image-container">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<div class="item-image-placeholder"><i class="fa-solid fa-image"></i></div>`}
                </div>
                
                <div class="item-details">
                    <div class="item-category" style="color:${family.color}">
                        <i class="fa-solid ${family.icon}"></i> ${family.name}
                    </div>
                    <h4 class="item-name">${item.name}</h4>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Ref: ${item.ref}</div>
                    
                    <div class="item-meta">
                        <div>
                            <span class="item-qty">${item.quantity}</span>
                            <span class="item-unit">${item.unit}</span>
                        </div>
                        <div style="font-weight:700; color:var(--success);">${formatCurrency(item.price || 0)}</div>
                    </div>
                    
                    <div class="item-actions">
                        <button class="action-btn-card" onclick="window.dispatchModal('item', '${item.id}')" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn-card primary" onclick="window.location.href='mobile-update.html?id=${item.id}'" title="Update Stock">
                            <i class="fa-solid fa-bolt"></i> Update
                        </button>
                         <button class="action-btn-card" onclick="window.deleteItemAction('${item.id}')" style="color:var(--danger); border-color:rgba(198, 40, 40, 0.1);" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // Bind Events
    document.getElementById('search-input').oninput = updateDisplay;
    document.getElementById('category-filter').onchange = updateDisplay;
    document.getElementById('status-filter').onchange = updateDisplay;

    // Initial Render
    updateDisplay();

    // Global helper for item deletion
    window.deleteItemAction = (id) => {
        if (confirm('Are you sure you want to permanently delete this item?')) {
            store.deleteItem(id);
            renderPage('stock-items');
        }
    };
}

function renderSettings(container) {
    container.innerHTML = `
        <div class="card" style="max-width: 800px;">
            <h3>General Settings</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-top:1.5rem;">
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <label style="font-size:0.875rem; font-weight:500;">Club Name</label>
                    <input type="text" value="LEO Club Curubis Korba" style="padding:0.75rem; border:1px solid #e2e8f0; border-radius:var(--radius-sm); width:100%;">
                </div>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <label style="font-size:0.875rem; font-weight:500;">Currency</label>
                    <select style="padding:0.75rem; border:1px solid #e2e8f0; border-radius:var(--radius-sm); width:100%;">
                        <option value="TND" selected>TND (Tunisian Dinar)</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                    </select>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <label style="font-size:0.875rem; font-weight:500;">Language</label>
                    <select style="padding:0.75rem; border:1px solid #e2e8f0; border-radius:var(--radius-sm); width:100%;">
                        <option value="en" selected>English</option>
                        <option value="fr">Français</option>
                        <option value="ar">العربية</option>
                    </select>
                </div>
            </div>

            <h3 style="margin-top:2rem;">Stock Configuration</h3>
            <div style="margin-top:1rem; display:flex; flex-direction:column; gap:1rem;">
                <label style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="checkbox" checked> Enable Price Tracking
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="checkbox" checked> Enable Images
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="checkbox"> Allow Negative Stock
                </label>
            </div>
            
            <div style="margin-top:2rem; text-align:right;">
                <button class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
}

function renderReports(container) {
    const header = document.createElement('div');
    header.innerHTML = `
        <h3 style="font-size:24px; font-weight:700; margin-bottom:0.5rem;">${t('reports')}</h3>
        <p style="color:var(--text-muted); margin-bottom:2rem;">Insights and data exports for inventory management.</p>
    `;
    container.appendChild(header);

    const reportGrid = document.createElement('div');
    reportGrid.className = 'item-grid';

    const reports = [
        { id: 'stock-family', title: 'Stock by Family', icon: 'fa-layer-group', color: '#007aff', desc: 'Current quantity breakdown per category.' },
        { id: 'low-stock', title: 'Low Stock Alerts', icon: 'fa-triangle-exclamation', color: '#ff3b30', desc: 'Items below minimum threshold.' },
        { id: 'donation-value', title: 'Donation Value', icon: 'fa-hand-holding-dollar', color: '#34c759', desc: 'Estimated value of current stock.' },
        { id: 'activity', title: 'Activity Analysis', icon: 'fa-chart-line', color: '#ff9500', desc: 'In/Out trends for the last 30 days.' }
    ];

    reportGrid.innerHTML = reports.map(r => `
        <div class="item-card" style="padding:1.5rem; text-align:center; min-height:220px; cursor:pointer;" onclick="window.generateReport('${r.id}')">
            <div style="width:60px; height:60px; background:${r.color}15; color:${r.color}; border-radius:18px; margin:0 auto 1.5rem auto; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                <i class="fa-solid ${r.icon}"></i>
            </div>
            <h4 style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem;">${t(r.id.replace('-', '_')) || r.title}</h4>
            <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4; margin-bottom:1.5rem;">${r.desc}</p>
            <button class="action-btn-card primary" style="width:100%; border-radius:12px;">Generate Review</button>
        </div>
    `).join('');

    container.appendChild(reportGrid);
}

window.generateReport = (type) => {
    let title = '';
    let reportHTML = '';

    if (type === 'stock-family') {
        title = 'Stock Breakdown by Family';
        const familyStats = store.getFamilyStats();
        reportHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Family</th><th>Total Items</th><th>Percentage</th></tr>
                    </thead>
                    <tbody>
                        ${familyStats.map(f => {
            const total = familyStats.reduce((s, i) => s + i.count, 0);
            const percent = total > 0 ? Math.round((f.count / total) * 100) : 0;
            return `
                                <tr>
                                    <td><div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:10px; height:10px; border-radius:50%; background:${f.color}"></span> ${f.name}</div></td>
                                    <td><b>${f.count}</b> units</td>
                                    <td>${percent}%</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (type === 'low-stock') {
        title = 'Low Stock Alerts';
        const lowStockItems = store.data.items.filter(i => i.quantity <= i.minQuantity);
        reportHTML = lowStockItems.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Item</th><th>Current</th><th>Minimum</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${lowStockItems.map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td style="color:var(--danger); font-weight:700">${i.quantity}</td>
                                <td>${i.minQuantity}</td>
                                <td><span class="badge danger">${i.quantity === 0 ? 'Out of Stock' : 'Low'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `<div style="text-align:center; padding:2rem; color:var(--success);"><i class="fa-solid fa-circle-check" style="font-size:2rem; margin-bottom:1rem;"></i><p>All items are at healthy stock levels!</p></div>`;
    } else if (type === 'donation-value') {
        title = 'Estimated Donation Value';
        const totalValue = store.data.items.reduce((acc, item) => acc + (item.quantity * (item.price || 0)), 0);
        reportHTML = `
            <div style="text-align:center; padding:2rem; background:var(--bg-body); border-radius:20px; margin-bottom:1.5rem;">
                <div style="font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:0.5rem;">Total Inventory Value</div>
                <div style="font-size:2.5rem; font-weight:800; color:var(--success); color:#34c759;">${formatCurrency(totalValue)}</div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Item</th><th>Value</th><th>Share</th></tr>
                    </thead>
                    <tbody>
                        ${store.data.items.filter(i => i.price > 0).sort((a, b) => (b.quantity * b.price) - (a.quantity * a.price)).slice(0, 5).map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td>${formatCurrency(i.quantity * i.price)}</td>
                                <td>${Math.round(((i.quantity * i.price) / totalValue) * 100)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (type === 'activity') {
        title = 'Recent Activity Summary';
        const last30Days = store.data.movements.length;
        const incoming = store.data.movements.filter(m => m.type === 'incoming').length;
        const outgoing = store.data.movements.filter(m => m.type === 'outgoing').length;

        reportHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                <div style="padding:1rem; background:#e3f9e5; color:#1e7e34; border-radius:12px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:800;">${incoming}</div>
                    <div style="font-size:0.75rem; font-weight:700;">INCOMING</div>
                </div>
                <div style="padding:1rem; background:#fee2e2; color:#b91c1c; border-radius:12px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:800;">${outgoing}</div>
                    <div style="font-size:0.75rem; font-weight:700;">OUTGOING</div>
                </div>
            </div>
            <div class="table-container">
                <table style="font-size:0.85rem;">
                    <thead>
                        <tr><th>Date</th><th>Item</th><th>Type</th></tr>
                    </thead>
                    <tbody>
                        ${store.data.movements.slice(0, 8).map(m => `
                            <tr>
                                <td>${m.date.split(' ')[0]}</td>
                                <td>${m.itemName}</td>
                                <td>${getMovementBadge(m.type)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    window.dispatchModal('raw', null, { title, body: reportHTML });
}

function renderUsers(container) {
    const users = store.data.users;

    const card = document.createElement('div');
    card.className = 'card';

    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.marginBottom = '1.5rem';
    toolbar.innerHTML = `
        <h3>System Users</h3>
        <button class="btn btn-primary" onclick="window.dispatchModal('user')"><i class="fa-solid fa-user-plus"></i> Add User</button>
    `;
    card.appendChild(toolbar);

    // Table
    const tableCont = document.createElement('div');
    tableCont.className = 'table-container';
    tableCont.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Avatar</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td><div style="width:32px; height:32px; background:var(--secondary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem;">${u.avatar}</div></td>
                        <td style="font-weight:500">${u.name}</td>
                        <td><span class="badge" style="background:#f1f5f9; color:var(--text-main)">${u.role}</span></td>
                        <td style="color:var(--text-muted)">${u.email}</td>
                        <td>${u.status === 'active' ? '<span class="badge success">Active</span>' : '<span class="badge danger">Disabled</span>'}</td>
                        <td>
                            <button onclick="window.dispatchModal('user', '${u.id || u.email}')" style="border:none; background:none; cursor:pointer; color:var(--text-muted); margin-right:0.5rem;"><i class="fa-solid fa-user-pen"></i></button>
                            <button onclick="window.deleteUserAction('${u.id || u.email}')" style="border:none; background:none; cursor:pointer; color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    card.appendChild(tableCont);
    container.appendChild(card);
}

function renderMembers(container) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '1.5rem';

    wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="font-size:1.5rem; font-weight:700;">Club Members</h3>
                <p style="color:var(--text-muted)">All registered members of LEO Club Curubis Korba</p>
            </div>
            <div id="member-count-badge" style="background:var(--primary); color:white; padding:0.75rem 1.25rem; border-radius:12px; font-weight:700;">
                <i class="fa-solid fa-users"></i> ${store.data.users.length} Members
            </div>
        </div>

        <div style="position:relative;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
            <input type="text" id="member-search-input" placeholder="Search members by name or email..." 
                   style="width:100%; padding:0.8rem 0.8rem 0.8rem 2.5rem; border:1px solid rgba(0,0,0,0.1); border-radius:12px; background:rgba(255,255,255,0.5); font-family:inherit;">
        </div>

        <div class="item-grid" id="members-grid"></div>
    `;
    container.appendChild(wrapper);

    const grid = document.getElementById('members-grid');
    const countBadge = document.getElementById('member-count-badge');

    const updateMembersDisplay = () => {
        // Use live data from store
        const users = store.data.users;
        const query = document.getElementById('member-search-input').value.toLowerCase();
        const filtered = users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query) ||
            (u.mobile && u.mobile.includes(query))
        );

        // Update member count
        countBadge.innerHTML = `<i class="fa-solid fa-users"></i> ${users.length} Members`;

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:5rem; opacity:0.2;">
                <i class="fa-solid fa-user-slash" style="font-size:4rem; margin-bottom:1rem;"></i>
                <p>No members found matching your search.</p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(u => {
            const lastSeen = u.lastSeen || 'Never';
            const mobile = u.mobile || 'Not provided';
            const isOnline = u.lastSeen && (Date.now() - new Date(u.lastSeen).getTime() < 5 * 60 * 1000); // Online if active in last 5 minutes

            return `
            <div class="card" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem; transition: transform 0.2s; position:relative;">
                ${isOnline ? '<div style="position:absolute; top:1rem; right:1rem; width:12px; height:12px; background:#34c759; border-radius:50%; box-shadow:0 0 0 3px rgba(52,199,89,0.2);"></div>' : ''}
                
                <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
                    <div style="width:80px; height:80px; background:${u.profilePicture ? 'transparent' : 'var(--primary)'}; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:700; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                        ${u.profilePicture ? `<img src="${u.profilePicture}" style="width:100%; height:100%; object-fit:cover;">` : u.avatar}
                    </div>
                    <div style="text-align:center;">
                        <h4 style="font-size:1.1rem; font-weight:700; margin-bottom:0.25rem;">${u.name}</h4>
                        <span class="badge" style="background:#f1f5f9; color:var(--text-main); font-size:0.75rem;">${u.role}</span>
                    </div>
                </div>

                <div style="background:var(--bg-body); padding:1rem; border-radius:12px; display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem;">
                        <i class="fa-solid fa-envelope" style="color:var(--primary); width:20px;"></i>
                        <span style="color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.email}</span>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; font-size:0.85rem;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                            <i class="fa-solid fa-phone" style="color:var(--primary); width:20px;"></i>
                            <span style="color:var(--text-muted); overflow:hidden; text-overflow:ellipsis;">${mobile}</span>
                        </div>
                        ${mobile && mobile !== 'Not provided' ? `
                            <a href="tel:${mobile}" class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.75rem; text-decoration:none; white-space:nowrap;" title="Call ${u.name}">
                                <i class="fa-solid fa-phone"></i> Call
                            </a>
                        ` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem;">
                        <i class="fa-solid fa-clock" style="color:${isOnline ? '#34c759' : 'var(--text-muted)'}; width:20px;"></i>
                        <span style="color:var(--text-muted);">${isOnline ? 'Online now' : 'Last seen: ' + lastSeen}</span>
                    </div>
                </div>

                ${u.status === 'active' ? '<span class="badge success" style="align-self:center;">Active</span>' : '<span class="badge danger" style="align-self:center;">Inactive</span>'}
                
                ${currentUser.role === 'Admin' ? `
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                        <button onclick="window.dispatchModal('user', '${u.id || u.email}')" class="btn btn-secondary" style="flex:1; justify-content:center; font-size:0.85rem; padding:0.6rem;">
                            <i class="fa-solid fa-user-pen"></i> Edit
                        </button>
                        <button onclick="window.deleteUserAction('${u.id || u.email}')" class="btn btn-secondary" style="flex:1; justify-content:center; font-size:0.85rem; padding:0.6rem; color:var(--danger); border-color:rgba(198,40,40,0.2);">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                ` : ''}
            </div>
            `;
        }).join('');
    };

    document.getElementById('member-search-input').oninput = updateMembersDisplay;
    updateMembersDisplay();
}

// Modal System
window.dispatchModal = (type, id = null, options = {}) => {
    let title = '';
    let body = '';
    let onSave = null;

    const container = document.getElementById('modal-container');
    container.innerHTML = '';

    if (type === 'item') {
        title = id ? 'Edit Item' : 'Add New Item';
        const families = store.data.families;
        body = `
            <div class="form-group">
                <label class="form-label">Item Name</label>
                <input type="text" id="m-name" class="form-input" required>
            </div>
             <div class="form-group">
                <label class="form-label">Reference Code</label>
                <input type="text" id="m-ref" class="form-input" value="AUTO-${Date.now().toString().substr(-6)}" required>
            </div>
             <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="m-family" class="form-input">
                        ${families.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                    </select>
                </div>
                 <div class="form-group">
                    <label class="form-label">Current Quantity</label>
                    <input type="number" id="m-qty" class="form-input" value="0">
                </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label class="form-label">Unit Price (TND)</label>
                    <input type="number" id="m-price" class="form-input" step="0.001" value="0">
                </div>
                 <div class="form-group">
                    <label class="form-label">Min. Stock Alert</label>
                    <input type="number" id="m-min" class="form-input" value="10">
                </div>
            </div>
             <div class="form-group">
                <label class="form-label">Image</label>
                <div class="image-preview-area" onclick="document.getElementById('m-image').click()">
                    <i class="fa-solid fa-cloud-arrow-up image-preview-icon"></i>
                    <p>Click to upload image</p>
                    <img id="m-preview" style="display:none; width:100%; height:100%; object-fit:cover;">
                </div>
                <input type="file" id="m-image" accept="image/*" onchange="previewImage(this)" style="display:none;">
            </div>
        `;
        onSave = async () => {
            const itemData = {
                name: document.getElementById('m-name').value,
                ref: document.getElementById('m-ref').value,
                familyId: document.getElementById('m-family').value,
                quantity: parseInt(document.getElementById('m-qty').value),
                price: parseFloat(document.getElementById('m-price').value),
                minQuantity: parseInt(document.getElementById('m-min').value),
                image: document.getElementById('m-preview').src
            };

            if (id) {
                await store.updateItem(id, itemData);
            } else {
                const newItem = { id: 'i' + Date.now(), ...itemData };
                await store.addItem(newItem);
                if (newItem.quantity > 0) {
                    await store.addMovement({
                        id: Date.now(),
                        itemId: newItem.id,
                        itemName: newItem.name,
                        type: 'adjustment',
                        quantity: newItem.quantity,
                        reason: 'Initial Stock',
                        date: new Date().toLocaleDateString('en-GB'),
                        user: auth.getCurrentUser().name
                    });
                }
            }
            renderPage('stock-items');
        };
        const populateEditData = () => {
            if (id) {
                const item = store.data.items.find(i => i.id === id);
                if (item) {
                    document.getElementById('m-name').value = item.name;
                    document.getElementById('m-ref').value = item.ref;
                    document.getElementById('m-family').value = item.familyId;
                    document.getElementById('m-qty').value = item.quantity;
                    document.getElementById('m-price').value = item.price || 0;
                    document.getElementById('m-min').value = item.minQuantity;
                    if (item.image) {
                        document.getElementById('m-preview').src = item.image;
                        document.getElementById('m-preview').style.display = 'block';
                    }
                    return true;
                }
            }
            return false;
        };

        setTimeout(() => {
            if (!populateEditData()) {
                // If cloud data is still loading, try again in 500ms
                setTimeout(populateEditData, 500);
            }
        }, 50);
    } else if (type === 'raw') {
        title = options.title;
        body = options.body;
        onSave = () => closeModal();
    } else if (type === 'view-photo') {
        title = 'Photo Viewer';
        body = `<div style="text-align:center;"><img src="${id}" style="max-width:100%; max-height:80vh; border-radius:15px; box-shadow:0 10px 30px rgba(0,0,0,0.1);"></div>`;
        onSave = () => closeModal();
    }
    else if (type === 'family') {
        title = 'New Family Category';
        body = `
            <div class="form-group">
                <label class="form-label">Category Name</label>
                <input type="text" id="f-name" class="form-input" placeholder="e.g. Syrian Refugee Family" required>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" id="f-desc" class="form-input" placeholder="Purpose of this category">
            </div>
            <div class="form-group">
                <label class="form-label">Theme Color</label>
                <input type="color" id="f-color" class="form-input" value="#781d26" style="height:50px;">
            </div>
        `;
        onSave = async () => {
            await store.addFamily({
                id: 'f' + Date.now(),
                name: document.getElementById('f-name').value,
                description: document.getElementById('f-desc').value,
                color: document.getElementById('f-color').value,
                icon: 'fa-users',
                requirements: []
            });
            renderPage('stock-impact');
        };
    } else if (type === 'user') {
        const user = id ? store.data.users.find(u => u.id == id || u.email == id) : null;
        title = id ? 'Edit User Permissions' : 'Add New User';

        const pages = [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'stock-impact', label: 'Impact Calc' },
            { id: 'stock-items', label: 'Items' },
            { id: 'stock-movements', label: 'Movements' },
            { id: 'gallery', label: 'Gallery' },
            { id: 'reports', label: 'Reports' },
            { id: 'users', label: 'User Management' },
            { id: 'settings', label: 'Settings' }
        ];

        const isMobile = window.innerWidth <= 768;
        body = `
            <div style="display:grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap:1.5rem;">
                <div>
                    <div class="form-group">
                        <label class="form-label">Full Name</label>
                        <input type="text" id="u-name" class="form-input" value="${user ? user.name : ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="u-email" class="form-input" value="${user ? user.email : ''}" ${id ? 'disabled' : ''} required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mobile Number</label>
                        <input type="tel" id="u-mobile" class="form-input" value="${user ? (user.mobile || '') : ''}" placeholder="+216 XX XXX XXX">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Role</label>
                        <select id="u-role" class="form-input">
                            <option value="Volunteer" ${user?.role === 'Volunteer' ? 'selected' : ''}>Volunteer</option>
                            <option value="Stock Manager" ${user?.role === 'Stock Manager' ? 'selected' : ''}>Stock Manager</option>
                            <option value="Admin" ${user?.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="form-label">Visible Pages & Permissions</label>
                    <div style="background:var(--bg-body); padding:1rem; border-radius:12px; display:flex; flex-direction:column; gap:0.55rem; max-height:250px; overflow-y:auto;">
                        ${pages.map(p => {
            const isChecked = user ? (user.role === 'Admin' || (user.permissions && user.permissions[p.id])) : (p.id !== 'users' && p.id !== 'settings');
            const isDisabled = user?.role === 'Admin';
            return `
                                <label style="display:flex; align-items:center; gap:0.75rem; cursor:${isDisabled ? 'default' : 'pointer'}; opacity:${isDisabled ? '0.5' : '1'}; font-size:0.9rem;">
                                    <input type="checkbox" class="u-perm" data-page="${p.id}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                                    ${p.label}
                                </label>
                            `;
        }).join('')}
                    </div>
                    ${user?.role === 'Admin' ? '<p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">Admin role has all permissions by default.</p>' : ''}
`;
        onSave = async () => {
            const name = document.getElementById('u-name').value.trim();
            // When editing, email input is disabled, so we fallback to the user object's email
            const emailInput = document.getElementById('u-email');
            const email = (emailInput.value || user?.email || '').trim();

            if (!name || (!id && !email)) {
                alert("Please fill in all required fields.");
                return false;
            }

            const role = document.getElementById('u-role').value;
            const mobile = document.getElementById('u-mobile').value.trim();
            const permissions = {};
            document.querySelectorAll('.u-perm').forEach(cb => {
                permissions[cb.getAttribute('data-page')] = cb.checked;
            });

            const userUpdates = { name, role, permissions, mobile };

            if (id) {
                await store.updateUser(id, userUpdates);
                await auth.updateUser(email, userUpdates); // Sync credentials
            } else {
                const newUser = {
                    id: Date.now(),
                    name,
                    email,
                    role,
                    permissions,
                    status: 'active',
                    avatar: name.substring(0, 2).toUpperCase()
                };
                await store.addUser(newUser);
                await auth.register(name, email, 'welcome123', false);
            }

            // Sync with local device saved accounts for the switcher
            let saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
            const saveIdx = saved.findIndex(s => s.email === email);
            if (saveIdx !== -1) {
                saved[saveIdx] = { ...saved[saveIdx], name, role, avatar: name.substring(0, 2).toUpperCase(), permissions };
                localStorage.setItem('leo_saved_accounts', JSON.stringify(saved));
            }

            renderPage('users');

            // If editing self or if emails match, apply changes now
            const curUser = auth.getCurrentUser();
            if (email === curUser?.email || id == curUser?.id) {
                const updatedSession = { ...curUser, ...userUpdates };
                localStorage.setItem('leo_current_user', JSON.stringify(updatedSession));
                location.reload();
            }
        };
    } else if (type === 'my-profile') {
        const user = currentUser;
        title = 'My Profile';

        body = `
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                <div style="text-align:center;">
                    <div style="width:100px; height:100px; background:${user.profilePicture ? 'transparent' : 'var(--primary)'}; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:700; overflow:hidden; margin:0 auto 1rem auto; box-shadow:0 4px 12px rgba(0,0,0,0.1); cursor:pointer;" onclick="document.getElementById('profile-pic-input').click()">
                        ${user.profilePicture ? `<img src="${user.profilePicture}" id="profile-pic-preview" style="width:100%; height:100%; object-fit:cover;">` : `<span id="profile-pic-preview">${user.avatar}</span>`}
                    </div>
                    <input type="file" id="profile-pic-input" accept="image/*" style="display:none;" onchange="window.previewProfilePicture(this)">
                    <p style="font-size:0.85rem; color:var(--text-muted);">Click to change profile picture</p>
                </div>

                <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input type="text" id="profile-name" class="form-input" value="${user.name}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input" value="${user.email}" disabled style="background:#f8fafc; cursor:not-allowed;">
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Email cannot be changed</p>
                </div>

                <div class="form-group">
                    <label class="form-label">Mobile Number</label>
                    <input type="tel" id="profile-mobile" class="form-input" value="${user.mobile || ''}" placeholder="+216 XX XXX XXX">
                </div>

                <div class="form-group">
                    <label class="form-label">Role</label>
                    <input type="text" class="form-input" value="${user.role}" disabled style="background:#f8fafc; cursor:not-allowed;">
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Contact an admin to change your role</p>
                </div>
            </div>
        `;

        onSave = async () => {
            const name = document.getElementById('profile-name').value.trim();
            const mobile = document.getElementById('profile-mobile').value.trim();
            const profilePicPreview = document.getElementById('profile-pic-preview');
            let profilePicture = user.profilePicture;

            // Check if profile picture was updated
            if (profilePicPreview.tagName === 'IMG') {
                profilePicture = profilePicPreview.src;
            }

            if (!name) {
                alert("Name cannot be empty");
                return false;
            }

            const updates = {
                name,
                mobile,
                profilePicture,
                avatar: name.substring(0, 2).toUpperCase(),
                lastSeen: new Date().toISOString()
            };

            // Update in Firestore
            await store.updateUser(user.email, updates);
            await auth.updateUser(user.email, updates);

            // Update current session
            const updatedUser = { ...user, ...updates };
            localStorage.setItem('leo_current_user', JSON.stringify(updatedUser));

            // Update saved accounts
            let saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
            const idx = saved.findIndex(s => s.email === user.email);
            if (idx !== -1) {
                saved[idx] = { ...saved[idx], ...updates };
                localStorage.setItem('leo_saved_accounts', JSON.stringify(saved));
            }

            location.reload();
        };
    }
    else if (type === 'gallery') {
        title = 'Post to Gallery';
        body = `
            <div class="form-group">
                <label class="form-label">Moment Photo</label>
                <div class="image-preview-area" onclick="document.getElementById('g-image').click()" style="height:250px;">
                    <i class="fa-solid fa-cloud-arrow-up image-preview-icon"></i>
                    <p>Click to upload or capture</p>
                    <img id="g-preview" style="display:none; width:100%; height:100%; object-fit:cover; border-radius:15px;">
                </div>
                <input type="file" id="g-image" accept="image/*" capture="environment" style="display:none;" onchange="previewImage(this)">
            </div>
            <div class="form-group">
                <label class="form-label">Club Event</label>
                <select id="g-event" class="form-input">
                    <option value="Hiver Chaud">Hiver Chaud</option>
                    <option value="Koffet Ramadan">Koffet Ramadan</option>
                    <option value="Rentré Scolaire">Rentré Scolaire</option>
                    <option value="General Events">General Events</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="g-desc" class="form-input" placeholder="What happened in this moment?" style="height:100px; resize:none;"></textarea>
            </div>
        `;
        onSave = async () => {
            const imgSrc = document.getElementById('g-preview').src;
            const desc = document.getElementById('g-desc').value;
            const event = document.getElementById('g-event').value;
            if (!imgSrc || imgSrc.startsWith('window')) return alert('Please select a photo');

            await store.addGalleryImage({
                id: Date.now(),
                image: imgSrc,
                description: desc || 'Memory from LEO Club',
                event: event,
                user: currentUser ? currentUser.name : 'Unknown User',
                date: new Date().toLocaleDateString('en-GB')
            });
            renderPage('gallery');
        };
    } else if (type === 'switch-account') {
        title = t('switch_account');
        const users = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
        body = `
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0.5rem;">Saved accounts on this device:</p>
                <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:300px; overflow-y:auto; padding-right:5px;">
                    ${users.length > 0 ? users.map(u => `
                        <div class="stat-card" style="padding:1rem; display:flex; align-items:center; justify-content:space-between; text-align:left; cursor:pointer; margin-bottom:0; background:rgba(0,0,0,0.02); border:1px solid rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;" onclick="window.instantSwitch('${u.email}')">
                            <div style="display:flex; align-items:center; gap:0.75rem;">
                                <div style="width:40px; height:40px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">${u.avatar || u.name.substring(0, 2).toUpperCase()}</div>
                                <div style="overflow: hidden;">
                                    <div style="font-weight:700; font-size:1rem; color:var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">${u.role}</div>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-right" style="opacity:0.3; color:var(--text-main);"></i>
                        </div>
                    `).join('') : '<div style="text-align:center; padding:2rem; opacity:0.5;">No other accounts saved on this device.</div>'}
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:0.5rem;">
                    <button class="btn btn-secondary" style="justify-content:center;" onclick="auth.logout()">
                        <i class="fa-solid fa-plus"></i> New Log In
                    </button>
                    <button class="btn btn-secondary" style="justify-content:center; color:var(--danger);" onclick="localStorage.removeItem('leo_saved_accounts'); location.reload();">
                        <i class="fa-solid fa-trash-can"></i> Clear Saved
                    </button>
                </div>
            </div>
        `;
        onSave = () => closeModal();
    }

    const modalHTML = `
        <div class="modal-overlay active" id="current-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">${body}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="modal-save-btn">Save</button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = modalHTML;
    document.getElementById('modal-save-btn').onclick = async () => {
        if (onSave) {
            const btn = document.getElementById('modal-save-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...';
            const result = await onSave();
            if (result === false) {
                btn.disabled = false;
                btn.innerHTML = 'Save';
                return;
            }
        }
        closeModal();
    };
};

// --- Gallery Logic ---

function renderGallery(container) {
    const images = store.data.gallery || [];

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '1.5rem';

    wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="font-size:1.5rem; font-weight:700;">Club Event Gallery</h3>
                <p style="color:var(--text-muted)">Capturing our club's history and impact.</p>
            </div>
            <button class="btn btn-primary" onclick="window.dispatchModal('gallery')">
                <i class="fa-solid fa-camera"></i> New Post
            </button>
        </div>

        <div style="display:flex; gap:1rem; align-items:center; background:rgba(255,255,255,0.4); padding:1rem; border-radius:15px; border:1px solid rgba(0,0,0,0.05);">
            <i class="fa-solid fa-filter" style="color:var(--text-muted)"></i>
            <select id="gallery-filter" style="background:none; border:none; font-family:inherit; font-weight:600; cursor:pointer; color:var(--text-main); font-size:0.9rem;">
                <option value="all">All Events</option>
                <option value="Hiver Chaud">Hiver Chaud</option>
                <option value="Koffet Ramadan">Koffet Ramadan</option>
                <option value="Rentré Scolaire">Rentré Scolaire</option>
                <option value="General Events">General Events</option>
            </select>
        </div>

        <div class="item-grid" id="gallery-grid"></div>
    `;
    container.appendChild(wrapper);

    const grid = document.getElementById('gallery-grid');

    const updateGallery = () => {
        const filter = document.getElementById('gallery-filter').value;
        const filtered = filter === 'all' ? images : images.filter(img => img.event === filter);

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:5rem; opacity:0.2;">
                <i class="fa-solid fa-images" style="font-size:4rem; margin-bottom:1rem;"></i>
                <p>No moments found for this category.</p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(img => `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; transition: transform 0.3s ease;">
                <div style="height:220px; position:relative; cursor:pointer;" onclick="window.viewFullPhoto('${img.image}')">
                    <img src="${img.image}" style="width:100%; height:100%; object-fit:cover;">
                    
                    <div style="position:absolute; bottom:0.75rem; left:0.75rem;">
                        <span style="background:white; color:var(--primary); padding:0.3rem 0.7rem; border-radius:8px; font-size:0.7rem; font-weight:800; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                            ${img.event || 'Event'}
                        </span>
                    </div>

                    <div style="position:absolute; top:0.75rem; right:0.75rem; display:flex; gap:0.5rem;">
                         <button onclick="window.downloadGalleryImage('${img.image}', ${img.id})" 
                                style="width:32px; height:32px; border-radius:50%; border:none; background:rgba(255,255,255,0.9); cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-download" style="font-size:0.8rem;"></i>
                        </button>
                        <button onclick="window.deleteGalleryImage(${img.id})" 
                                style="width:32px; height:32px; border-radius:50%; border:none; background:rgba(198,40,40,0.9); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-trash" style="font-size:0.8rem;"></i>
                        </button>
                    </div>
                </div>
                <div style="padding:1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:0.4rem;">
                        <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${img.date}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;"><i class="fa-solid fa-user-tag"></i> ${img.user || 'Unknown'}</div>
                    </div>
                    <p style="font-weight:500; font-size:0.95rem; line-height:1.4;">${img.description}</p>
                </div>
            </div>
        `).join('');
    };

    document.getElementById('gallery-filter').onchange = updateGallery;
    updateGallery();
}

window.downloadGalleryImage = (url, id) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `LEO_Event_${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.deleteGalleryImage = (id) => {
    if (confirm('Delete this moment?')) {
        store.deleteGalleryImage(id);
        renderPage('gallery');
    }
};

window.closeModal = () => { document.getElementById('modal-container').innerHTML = ''; };

window.previewImage = (input) => {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('m-preview') || document.getElementById('g-preview');
            if (img) {
                img.src = e.target.result;
                img.style.display = 'block';
                // Hide placeholders for gallery modal
                const icon = document.querySelector('.image-preview-icon');
                const p = document.querySelector('.image-preview-area p');
                if (icon) icon.style.display = 'none';
                if (p) p.style.display = 'none';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.previewProfilePicture = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('profile-pic-preview');
            if (preview) {
                if (preview.tagName === 'SPAN') {
                    // Replace span with img
                    const img = document.createElement('img');
                    img.id = 'profile-pic-preview';
                    img.src = e.target.result;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    preview.parentElement.replaceChild(img, preview);
                } else {
                    preview.src = e.target.result;
                }
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.deleteUserAction = async (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
        const currentUser = auth.getCurrentUser();
        // Use loose equality to check ID
        if (id == currentUser.id || id === currentUser.email) {
            return alert("You cannot delete yourself!");
        }

        // Find email for auth deletion
        const user = store.data.users.find(u => u.id == id || u.email == id);
        if (user) {
            await auth.deleteUser(user.email);
            await store.deleteUser(id);
        }
        renderPage('users');
    }
};

window.instantSwitch = (email) => {
    // 1. Try to find the user in the latest cloud data in memory
    let targetUser = store.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    // 2. Fallback to device's saved accounts if cloud data isn't loaded yet
    if (!targetUser) {
        const saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
        targetUser = saved.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (targetUser) {
        localStorage.setItem('leo_current_user', JSON.stringify(targetUser));
        location.reload();
    } else {
        alert("Account not found. Please log in with this account first.");
    }
};

// Expose core functions for template string event handlers
window.auth = auth;
window.renderPage = renderPage;
window.formatCurrency = formatCurrency;
window.getMovementBadge = getMovementBadge;

window.viewFullPhoto = (url) => {
    window.dispatchModal('view-photo', url);
};
