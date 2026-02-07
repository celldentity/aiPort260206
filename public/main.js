// [v61] Aura Arcade Engine & UI Fixes
document.addEventListener('DOMContentLoaded', () => {
    // AGGRESSIVE CACHE CLEARING - v61
    const CURRENT_VERSION = 'v61';
    const storedVersion = localStorage.getItem('app_version');

    if (storedVersion !== CURRENT_VERSION) {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('app_version', CURRENT_VERSION);
        console.log('🧹 Cleared cache! Reloading v61...');
        setTimeout(() => location.reload(true), 100);
        return;
    }

    // Auth & Elements
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const loginContainer = document.getElementById('login-form-container');
    const signupContainer = document.getElementById('signup-form-container');

    // Settings elements
    const profileForm = document.getElementById('profile-form');
    const logoutBtn = document.getElementById('logout-btn');
    const infoUsername = document.getElementById('info-username');
    const infoName = document.getElementById('info-name');
    const infoEmail = document.getElementById('info-email');

    // Guestbook Elements
    const gbList = document.getElementById('guestbook-list');
    const gbInput = document.getElementById('guestbook-input');
    const gbSubmit = document.getElementById('guestbook-submit');

    const searchInput = document.getElementById('car-search');
    const searchContainer = document.querySelector('.nav-search');
    const searchSection = document.getElementById('search-results');
    const queryDisplay = document.getElementById('search-query-display');
    const countDisplay = document.getElementById('search-count-display');
    const noResultsMsg = document.getElementById('search-no-results');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const searchModal = document.getElementById('search-modal');

    const auraCursor = document.querySelector('.aura-cursor');
    const body = document.body;
    const canvas = document.getElementById('ai-background');
    const ctx = canvas ? canvas.getContext('2d') : null;

    // --- State Management ---
    let currentUser = null;
    let activeTab = 'home';

    // 로컬 데이터 저장소 (검색 및 미리보기용)
    let allCars = [];
    let allRecipes = [];
    let allNews = [];
    let allCoding = [];

    // 로딩 상태 관리
    let loadingStatus = { cars: false, recipes: false, news: false, coding: false };
    let cursors = { newsStart: 1 };
    let hasMoreNews = true;
    let isFetchingNews = false;

    // --- Canvas Particles ---
    let particles = [];
    let dpr = window.devicePixelRatio || 1;

    function initCanvas() {
        if (!canvas || !ctx) return;

        const displayWidth = window.innerWidth || document.documentElement.clientWidth;
        const displayHeight = window.innerHeight || document.documentElement.clientHeight;

        if (displayWidth === 0 || displayHeight === 0) return;

        dpr = window.devicePixelRatio || 1;
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';

        // 매 초기화마다 파티클을 새로 생성하여 영역에 맞춤
        createParticles();

        // 중요: 누적 스케일 방지를 위해 변환 행렬 초기화 후 dpr 적용
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    class Particle {
        constructor() {
            const w = canvas?.width / dpr || window.innerWidth;
            const h = canvas?.height / dpr || window.innerHeight;
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.vx = (Math.random() - 0.5) * 0.15;
            this.vy = (Math.random() - 0.5) * 0.15;
            this.radius = Math.random() * 2 + 1.5;
        }
        update() {
            if (!canvas) return;
            const w = canvas.width / dpr;
            const h = canvas.height / dpr;
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > w) this.vx *= -1;
            if (this.y < 0 || this.y > h) this.vy *= -1;
        }
        draw() {
            if (!ctx) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }
    }

    function createParticles() {
        particles = [];
        const count = window.innerWidth < 800 ? 40 : 60; // 모바일/PC 개수 최적화
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function animate() {
        if (!ctx || !canvas) return requestAnimationFrame(animate);

        const w = canvas.width / dpr;
        const h = canvas.height / dpr;

        // 매 프레임 변환 행렬 리셋 후 dpr 적용 (가장 안전한 방법)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w + 10, h + 10);

        particles.forEach((p, index) => {
            p.update();
            p.draw();
            for (let j = index + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.8;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        });
        requestAnimationFrame(animate);
    }

    // --- 초기화 시퀀스 (Bulletproof) ---
    initCanvas();
    animate();

    // 1. 레이아웃 안정화 후 재실행 (200ms)
    setTimeout(initCanvas, 200);

    // 2. 끈질긴 감시 루프 (3초간 0.5초마다 캔버스 유효성 체크)
    let checkCount = 0;
    const checkInterval = setInterval(() => {
        if (canvas && (canvas.width === 0 || particles.length === 0)) {
            initCanvas();
        }
        if (++checkCount > 6) clearInterval(checkInterval);
    }, 500);

    // 3. 브라우저 크기 변화 감지 (ResizeObserver)
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            initCanvas();
        });
        ro.observe(document.body);
    } else {
        window.addEventListener('resize', initCanvas);
    }

    // --- Authentication ---
    const switchToSignup = document.getElementById('go-signup');
    const switchToLogin = document.getElementById('go-login');
    switchToSignup?.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; });
    switchToLogin?.addEventListener('click', (e) => { e.preventDefault(); signupContainer.style.display = 'none'; loginContainer.style.display = 'block'; });

    signupForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value, username = document.getElementById('reg-username').value,
            email = document.getElementById('reg-email').value, password = document.getElementById('reg-password').value;
        const userRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]{8,}$/;
        if (!userRegex.test(username)) return alert('아이디는 영문이랑 숫자를 섞어서 8자 넘게 만들어주세요! 🤙');
        const users = JSON.parse(localStorage.getItem('aura_users') || '{}');
        if (users[username]) return alert('어라? 이 아이디는 이미 누군가 쓰고 있어요! 😮');
        users[username] = { name, username, email, password };
        localStorage.setItem('aura_users', JSON.stringify(users));
        alert('우와아! 가입을 축하해요! 🎉'); switchToLogin.click();
    });

    function loginUser(user, isPersistent = true) {
        currentUser = user;
        if (isPersistent) sessionStorage.setItem('aura_session', JSON.stringify(user));
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none'; appContainer.style.display = 'block'; body.classList.replace('initial-state', 'logged-in');
            updateSettingsUI(); loadGuestbook();
            setSearchLoading(true);
            loadAIInsights(); // [v57] Load AI Papers & Market Data

            // 데이터 로딩 전략 (v48 + v53 Preview)
            backgroundFullLoad('cars');
            backgroundFullLoad('recipes');
            backgroundFullLoad('coding');
            fetchNextNews();

            initIntersectionObserver();
            const targetTab = location.hash.replace('#', '') || sessionStorage.getItem('aura_active_tab') || 'home';
            switchTab(targetTab === 'search' ? 'home' : targetTab, false);
        }, 800);
    }

    const session = sessionStorage.getItem('aura_session');
    if (session) loginUser(JSON.parse(session), false);

    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value, p = document.getElementById('password').value;
        const users = JSON.parse(localStorage.getItem('aura_users') || '{}');
        if (users[u] && users[u].password === p) loginUser(users[u]);
        else if (u === 'admin' && p === '1234') loginUser({ username: 'admin', name: 'Admin', email: 'admin@mbc.ai' });
        else alert('잉? 아이디나 비밀번호가 틀린 것 같아요! 다시 확인해줄래요? 🧐');
    });

    // --- Dashboard Preview System (v53) ---
    function updateDashboardPreview(type) {
        const cardId = type === 'cars' ? 'card-car' : type === 'recipes' ? 'card-recipe' : type === 'coding' ? 'card-coding' : 'card-news';
        const card = document.getElementById(cardId);
        if (!card) return;

        const data = type === 'cars' ? allCars : type === 'recipes' ? allRecipes : type === 'coding' ? allCoding : allNews;
        const itemsWithImg = data.filter(i => i.imageUrl);

        if (itemsWithImg.length > 0) {
            const randomItem = itemsWithImg[Math.floor(Math.random() * itemsWithImg.length)];
            let bg = card.querySelector('.card-preview-bg');
            if (!bg) {
                bg = document.createElement('div');
                bg.className = 'card-preview-bg';
                card.prepend(bg);
            }
            bg.style.backgroundImage = `url(${randomItem.imageUrl})`;
            setTimeout(() => bg.classList.add('loaded'), 100);
        }
    }

    // --- Search Status Control ---
    function setSearchLoading(isLoading) {
        if (isLoading) {
            searchContainer?.classList.add('loading');
            searchInput.placeholder = "데이터 로딩 중... ⏳";
            searchInput.disabled = true;
        } else {
            if (!loadingStatus.cars && !loadingStatus.recipes && !loadingStatus.coding) {
                searchContainer?.classList.remove('loading');
                searchInput.placeholder = "검색어 입력 후 Enter...";
                searchInput.disabled = false;
            }
        }
    }

    // --- Data Loading ---
    async function backgroundFullLoad(type) {
        loadingStatus[type] = true;
        let hasMore = true, cursor = null, isFirstBatch = true;
        const gridId = type === 'cars' ? 'gallery-grid' : type === 'recipes' ? 'recipe-grid' : 'coding-grid';

        while (hasMore) {
            try {
                const resp = await fetch(`/api/${type}?size=50${cursor ? `&cursor=${cursor}` : ''}`);
                if (!resp.ok) throw new Error(`API Error: ${resp.status}`);
                const data = await resp.json();

                if (data && data.items && Array.isArray(data.items)) {
                    if (type === 'cars') allCars.push(...data.items);
                    else if (type === 'recipes') allRecipes.push(...data.items);
                    else allCoding.push(...data.items);

                    if (activeTab === (type === 'cars' ? 'gallery' : type === 'recipes' ? 'recipe' : 'coding')) {
                        appendData(data.items, gridId, false);
                    }
                    if (isFirstBatch) { updateDashboardPreview(type); isFirstBatch = false; }
                    hasMore = data.hasMore;
                    cursor = data.nextCursor;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                console.error(`[Aura] Failed to load ${type}:`, e);
                hasMore = false;
            }
        }
        loadingStatus[type] = false;
        setSearchLoading(false);
    }

    async function fetchNextNews() {
        if (isFetchingNews || !hasMoreNews) return;
        isFetchingNews = true;
        try {
            const resp = await fetch(`/api/news?start=${cursors.newsStart}`);
            if (!resp.ok) throw new Error(`News API Error: ${resp.status}`);
            const data = await resp.json();

            if (data && data.items && Array.isArray(data.items)) {
                allNews.push(...data.items);
                appendData(data.items, 'news-grid', true);
                cursors.newsStart = data.nextStart;
                hasMoreNews = data.hasMore;
                updateDashboardPreview('news');
            } else {
                hasMoreNews = false;
            }
        } catch (e) {
            console.error('[Aura] Failed to load news:', e);
            hasMoreNews = false;
        }
        finally { isFetchingNews = false; }
    }

    function initIntersectionObserver() {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (entry.target.id === 'news-sentinel') fetchNextNews();
                }
            });
        }, { threshold: 0.1 });
        const sentinel = document.getElementById('news-sentinel');
        if (sentinel) obs.observe(sentinel);
    }

    // --- Local Search System ---
    // 모바일 전용 검색 아이콘(동그라미) 클릭 시 처리
    searchContainer?.addEventListener('click', (e) => {
        if (window.innerWidth <= 800) {
            searchModal.classList.add('active');
            mobileSearchInput?.focus();
        }
    });

    searchInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') performLocalSearch(searchInput.value.trim().toLowerCase());
    });

    mobileSearchInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            performLocalSearch(mobileSearchInput.value.trim().toLowerCase());
            searchModal.classList.remove('active');
            body.style.overflow = 'auto';
        }
    });

    function performLocalSearch(query) {
        if (!query) return;
        activeTab = 'search-results'; location.hash = 'search';
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        searchSection.classList.add('active');
        searchInput.blur();
        queryDisplay.innerHTML = `<span>'${query}'</span>` + " 검색 결과";

        const filteredCars = allCars.filter(i => i.name.toLowerCase().includes(query));
        const filteredRecipes = allRecipes.filter(i => i.name.toLowerCase().includes(query));
        const filteredNews = allNews.filter(i => i.name.toLowerCase().includes(query));
        const filteredCoding = allCoding.filter(i => i.name.toLowerCase().includes(query));

        renderSearchSubGrid('search-grid-cars', 'search-section-cars', filteredCars, false);
        renderSearchSubGrid('search-grid-recipes', 'search-section-recipes', filteredRecipes, false);
        renderSearchSubGrid('search-grid-news', 'search-section-news', filteredNews, true);
        renderSearchSubGrid('search-grid-coding', 'search-section-coding', filteredCoding, false);

        const total = filteredCars.length + filteredRecipes.length + filteredNews.length + filteredCoding.length;
        countDisplay.innerText = `로딩된 데이터에서 총 ${total}개의 항목을 발견했습니다.`;
        noResultsMsg.style.display = total === 0 ? 'block' : 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderSearchSubGrid(gridId, sectionId, items, isNews) {
        const grid = document.getElementById(gridId); const section = document.getElementById(sectionId);
        if (!grid || !section) return; grid.innerHTML = '';
        if (items.length === 0) section.style.display = 'none';
        else { section.style.display = 'block'; appendData(items, gridId, isNews); }
    }

    // --- Navigation ---
    function switchTab(tabId, updateHash = true) {
        activeTab = tabId; sessionStorage.setItem('aura_active_tab', tabId);
        if (updateHash) location.hash = tabId;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tabId));

        // Tab Content Switching
        const sections = {
            'home': 'home',
            'news': 'news',
            'coding': 'coding',
            'recipe': 'recipe',
            'gallery': 'gallery',
            'minigame': 'game-section',
            'settings': 'settings',
            'search-results': 'search-results'
        };

        Object.values(sections).forEach(sid => {
            const el = document.getElementById(sid);
            if (el) {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        });

        const activeSectionId = sections[tabId];
        if (activeSectionId) {
            const activeEl = document.getElementById(activeSectionId);
            if (activeEl) {
                activeEl.style.display = 'block';
                activeEl.classList.add('active');
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        const gridId = tabId === 'gallery' ? 'gallery-grid' : tabId === 'recipe' ? 'recipe-grid' : tabId === 'news' ? 'news-grid' : tabId === 'coding' ? 'coding-grid' : null;
        if (gridId) {
            const grid = document.getElementById(gridId);
            if (grid && grid.children.length === 0) {
                const data = tabId === 'gallery' ? allCars : tabId === 'recipe' ? allRecipes : tabId === 'news' ? allNews : allCoding;
                if (data.length > 0) appendData(data, gridId, tabId === 'news');
            }
        }
    }

    window.addEventListener('hashchange', () => {
        const tab = location.hash.replace('#', '');
        if (tab && tab !== 'search' && currentUser) switchTab(tab, false);
    });
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchTab(item.getAttribute('data-tab'))));

    // --- Filter & Sorting Logic (Local) ---
    function refreshGrid(data, id, isNews) {
        const g = document.getElementById(id); if (g) { g.innerHTML = ''; appendData(data, id, isNews); }
    }

    function setupDropdown(id, tid, typeKey) {
        const d = document.getElementById(id); if (!d) return;
        const trigger = d.querySelector('.dropdown-trigger');
        const textSpan = document.getElementById(tid);
        trigger.addEventListener('click', e => { e.stopPropagation(); d.classList.toggle('open'); });
        d.querySelectorAll('.dropdown-item').forEach(i => i.addEventListener('click', () => {
            const sortType = i.getAttribute('data-sort');
            textSpan.innerText = i.innerText;
            d.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active')); i.classList.add('active');
            const target = typeKey === 'cars' ? allCars : allRecipes;
            const targetGrid = typeKey === 'cars' ? 'gallery-grid' : 'recipe-grid';
            target.sort((a, b) => sortType === 'desc' ? b.name.localeCompare(a.name, 'ko') : a.name.localeCompare(b.name, 'ko'));
            refreshGrid(target, targetGrid, false); d.classList.remove('open');
        }));
    }
    setupDropdown('sort-dropdown', 'current-sort', 'cars');
    setupDropdown('recipe-sort-dropdown', 'current-recipe-sort', 'recipes');

    document.addEventListener('click', () => { document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open')); });

    // --- Utilities ---
    function appendData(data, id, isNews) {
        const g = document.getElementById(id); if (!g || !data) return;
        data.forEach(item => {
            const div = document.createElement('div'); div.className = item.imageUrl ? 'gallery-item' : 'gallery-item no-image';
            div.innerHTML = `<div class="card-glow"></div>${item.imageUrl ? `<img src="${item.imageUrl}" loading="lazy">` : ''}<div class="car-info"><h4>${item.name}</h4><p style="font-size:0.8rem; opacity:0.5;">${item.pubDate || ''}</p></div>`;
            div.addEventListener('click', () => (isNews || item.link) ? window.open(item.link || '#', '_blank') : openModal(item));
            g.appendChild(div);
        });
    }

    function loadGuestbook() {
        const messages = JSON.parse(localStorage.getItem('aura_guestbook') || '[]');
        if (!gbList) return;
        gbList.innerHTML = messages.length ? '' : '<p class="no-results-msg">첫 인사를 남겨주세요! 😊</p>';
        messages.slice().reverse().forEach((msg, index) => {
            const originalIndex = messages.length - 1 - index;
            const div = document.createElement('div'); div.className = 'guest-item';
            const isOwner = currentUser && (msg.username === currentUser.username);
            div.innerHTML = `
                <div class="guest-meta">
                    <span class="guest-name">${msg.name}</span>
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <span class="guest-date">${msg.date}</span>
                        ${isOwner ? `<button class="gb-delete-btn" data-index="${originalIndex}"><ion-icon name="close-outline"></ion-icon></button>` : ''}
                    </div>
                </div>
                <div class="guest-text">${msg.text}</div>
            `;
            gbList.appendChild(div);
        });

        // Add delete event listeners
        document.querySelectorAll('.gb-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (confirm('이 방명록을 삭제할까요?')) {
                    const msgs = JSON.parse(localStorage.getItem('aura_guestbook') || '[]');
                    msgs.splice(idx, 1);
                    localStorage.setItem('aura_guestbook', JSON.stringify(msgs));
                    loadGuestbook();
                }
            });
        });
    }

    gbSubmit?.addEventListener('click', () => {
        const text = gbInput.value.trim(); if (!text || text.length > 200) return alert(text ? '200자 이내로 써주세요! 🌸' : '내용을 입력해주세요! ✍️');
        const messages = JSON.parse(localStorage.getItem('aura_guestbook') || '[]');
        messages.push({
            name: currentUser.name,
            username: currentUser.username,
            text,
            date: new Date().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem('aura_guestbook', JSON.stringify(messages));
        gbInput.value = ''; loadGuestbook();
    });

    logoutBtn?.addEventListener('click', () => { if (confirm('정말 로그아웃 하시겠어요? 🥺')) { sessionStorage.clear(); location.hash = ''; location.reload(); } });
    function updateSettingsUI() {
        if (!currentUser) return;
        infoUsername.innerText = currentUser.username; infoName.innerText = currentUser.name; infoEmail.innerText = currentUser.email;
        document.getElementById('update-name').value = currentUser.name; document.getElementById('update-email').value = currentUser.email;
    }
    profileForm?.addEventListener('submit', e => {
        e.preventDefault();
        const nN = document.getElementById('update-name').value, nE = document.getElementById('update-email').value,
            nP = document.getElementById('update-password').value, cP = document.getElementById('confirm-password').value;
        if (nP && nP !== cP) return alert('비밀번호가 서로 달라요! 😵');
        const users = JSON.parse(localStorage.getItem('aura_users') || '{}');
        if (currentUser.username === 'admin') return alert('관리자 정보는 수정 불가! 🤫');
        users[currentUser.username].name = nN; users[currentUser.username].email = nE;
        if (nP) users[currentUser.username].password = nP;
        localStorage.setItem('aura_users', JSON.stringify(users));
        currentUser = users[currentUser.username]; sessionStorage.setItem('aura_session', JSON.stringify(currentUser));
        updateSettingsUI(); alert('정보 업데이트 완료! ✨');
    });

    const modal = document.getElementById('detail-modal');
    const modalBody = document.querySelector('.modal-body');

    function openModal(d) {
        const modalImg = document.getElementById('modal-img');
        const modalTitle = document.getElementById('modal-title');
        const modalSummary = document.getElementById('modal-summary');

        if (d.youtubeId) {
            // YouTube Embed 모드
            modalBody.innerHTML = `
                <div class="video-container">
                    <iframe src="https://www.youtube.com/embed/${d.youtubeId}?autoplay=1" 
                            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen></iframe>
                </div>
                <div class="modal-text-container">
                    <h2>${d.name}</h2>
                    <p>${d.summary}</p>
                </div>
            `;
        } else {
            // 일반 이미지 모드 (원상복구 대비 초기 구조 유지)
            modalBody.innerHTML = `
                <div class="modal-image-container">
                    <img id="modal-img" src="${d.imageUrl}" alt="${d.name}">
                </div>
                <div class="modal-text-container">
                    <h2 id="modal-title">${d.name}</h2>
                    <p id="modal-summary">${d.summary}</p>
                </div>
            `;
        }

        modal.classList.add('active');
        body.style.overflow = 'hidden';

        setTimeout(() => {
            if (modalBody) modalBody.scrollTop = 0;
            if (modal) modal.scrollTop = 0;
        }, 10);
    }

    // Modal Closing Logic (v60)
    function closeModal() {
        modal.classList.remove('active');
        body.style.overflow = 'auto';
        // HTML inner content cleanup to stop videos
        setTimeout(() => { modalBody.innerHTML = ''; }, 300);
    }

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.getElementById('close-detail-modal')?.addEventListener('click', closeModal);

    // Escape key to close modal
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

    // --- AI Insights System (v65 - Auto-refresh + Korean Stocks) ---
    let stockRefreshInterval = null;

    async function loadAIInsights() {
        const marketList = document.getElementById('market-list');
        const papersList = document.getElementById('papers-list');

        // US + Korean stock symbols with REAL fallback data (Feb 6-7, 2026)
        const usStocks = [
            { symbol: 'NVDA', name: 'NVIDIA', region: 'US', fallback: { price: 185.40, change: 13.77, percent: 8.01 } },
            { symbol: 'MSFT', name: 'Microsoft', region: 'US', fallback: { price: 401.14, change: -2.45, percent: -0.61 } },
            { symbol: 'GOOGL', name: 'Alphabet', region: 'US', fallback: { price: 322.86, change: 4.55, percent: 1.43 } },
            { symbol: 'AAPL', name: 'Apple', region: 'US', fallback: { price: 278.12, change: 2.21, percent: 0.80 } },
            { symbol: 'TSLA', name: 'Tesla', region: 'US', fallback: { price: 411.11, change: -8.90, percent: -2.12 } }
        ];

        const krStocks = [
            { symbol: '005930.KS', name: '삼성전자', region: 'KR', fallback: { price: 112400, change: 1200, percent: 1.08 } },
            { symbol: '000660.KS', name: 'SK하이닉스', region: 'KR', fallback: { price: 839000, change: 15000, percent: 1.82 } },
            { symbol: '035420.KS', name: 'NAVER', region: 'KR', fallback: { price: 249000, change: -3000, percent: -1.19 } },
            { symbol: '035720.KS', name: '카카오', region: 'KR', fallback: { price: 56200, change: 800, percent: 1.44 } },
            { symbol: '005380.KS', name: '현대차', region: 'KR', fallback: { price: 467500, change: 5500, percent: 1.19 } }
        ];

        // Load stock data with fallback
        if (marketList) {
            try {
                const loadStocks = async (stocks) => {
                    const stockPromises = stocks.map(async (stock) => {
                        try {
                            // Try FMP API (demo key works for limited requests)
                            const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${stock.symbol}?apikey=demo`, { timeout: 3000 });
                            const data = await response.json();

                            if (data && data.length > 0 && data[0].price > 0) {
                                const quote = data[0];
                                return {
                                    symbol: stock.symbol,
                                    name: stock.name,
                                    region: stock.region,
                                    price: quote.price,
                                    change: quote.change || 0,
                                    percent: quote.changesPercentage || 0,
                                    isLive: true
                                };
                            }
                            throw new Error('Invalid API response');
                        } catch (e) {
                            // Use fallback data
                            return {
                                symbol: stock.symbol,
                                name: stock.name,
                                region: stock.region,
                                price: stock.fallback.price,
                                change: stock.fallback.change,
                                percent: stock.fallback.percent,
                                isLive: false
                            };
                        }
                    });
                    return await Promise.all(stockPromises);
                };

                const [usData, krData] = await Promise.all([loadStocks(usStocks), loadStocks(krStocks)]);
                const hasLiveData = [...usData, ...krData].some(s => s.isLive);

                const renderStock = (s) => {
                    const priceStr = s.region === 'KR'
                        ? `₩${s.price.toLocaleString('ko-KR')}`
                        : `$${s.price.toFixed(2)}`;
                    return `
                        <div class="market-item">
                            <div class="market-info-left">
                                <span class="market-symbol">${s.name}</span>
                                <span class="market-name">${s.symbol.replace('.KS', '')}</span>
                            </div>
                            <div class="market-info-right">
                                <div class="market-price">${priceStr}</div>
                                <div class="market-change ${s.change >= 0 ? 'up' : 'down'}">
                                    ${s.change >= 0 ? '▲' : '▼'} ${Math.abs(s.percent).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    `;
                };

                marketList.innerHTML = `
                    <div class="market-region-header">🇺🇸 US Tech Markets ${hasLiveData ? '(실시간)' : '(참고용)'}</div>
                    ${usData.map(renderStock).join('')}
                    <div class="market-region-header" style="margin-top:1rem;">🇰🇷 한국 주요 종목 ${hasLiveData ? '(실시간)' : '(참고용)'}</div>
                    ${krData.map(renderStock).join('')}
                    <p style="font-size:0.7rem; opacity:0.5; text-align:center; margin-top:1rem;">
                        ${new Date().toLocaleTimeString('ko-KR')} 업데이트 ${hasLiveData ? '' : '(API 제한)'}
                    </p>
                `;
            } catch (e) {
                console.error('Market load failed', e);
                marketList.innerHTML = '<p class="loading-msg">시장 데이터 로딩 실패</p>';
            }
        }

        // Load ArXiv Papers
        try {
            const pResp = await fetch('/api/insights/papers');
            const papers = await pResp.json();
            if (papersList && Array.isArray(papers)) {
                papersList.innerHTML = papers.map(p => `
                    <a href="${p.link}" target="_blank" class="paper-item">
                        <span class="paper-date">${new Date(p.published).toLocaleDateString()}</span>
                        <h5>${p.title}</h5>
                        <p style="font-size:0.75rem; opacity:0.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${p.summary}</p>
                    </a>
                `).join('');
            }
        } catch (e) {
            if (papersList) papersList.innerHTML = '<p class="loading-msg">논문을 가져오지 못했습니다. 😢</p>';
        }
    }

    // Auto-refresh stock data every 30 seconds
    function startStockRefresh() {
        if (stockRefreshInterval) clearInterval(stockRefreshInterval);
        stockRefreshInterval = setInterval(loadAIInsights, 30000); // 30 seconds
    }

    // --- [v66] Tetris Game ---
    const tetrisCanvas = document.getElementById('tetris-canvas');
    const tetrisCtx = tetrisCanvas?.getContext('2d');
    const nextCanvas = document.getElementById('next-canvas');
    const nextCtx = nextCanvas?.getContext('2d');
    const startTetrisBtn = document.getElementById('btn-tetris-start');
    const tetrisLanding = document.getElementById('tetris-landing');
    const tetrisHUD = document.getElementById('tetris-hud');
    const tetrisMsg = document.getElementById('tetris-message');
    const tetrisMsgText = document.getElementById('tetris-msg-text');
    const tetrisScoreEl = document.getElementById('tetris-score');
    const tetrisLevelEl = document.getElementById('tetris-level');
    const tetrisLinesEl = document.getElementById('tetris-lines');

    // Game constants
    const COLS = 10, ROWS = 20, BLOCK_SIZE = 30;
    const COLORS = [
        ['#ff006e', '#8338ec'], // I - Pink to Purple
        ['#ffbe0b', '#fb5607'], // O - Yellow to Orange
        ['#3a86ff', '#8338ec'], // T - Blue to Purple
        ['#06ffa5', '#00d9ff'], // S - Cyan to Blue
        ['#ff006e', '#ff4d6d'], // Z - Pink to Red
        ['#ffbe0b', '#ff006e'], // J - Yellow to Pink
        ['#06ffa5', '#3a86ff']  // L - Cyan to Blue
    ];

    // Tetromino shapes
    const SHAPES = [
        [[1, 1, 1, 1]], // I
        [[1, 1], [1, 1]], // O
        [[0, 1, 0], [1, 1, 1]], // T
        [[0, 1, 1], [1, 1, 0]], // S
        [[1, 1, 0], [0, 1, 1]], // Z
        [[1, 0, 0], [1, 1, 1]], // J
        [[0, 0, 1], [1, 1, 1]]  // L
    ];

    // Game state
    let gameActive = false, score = 0, level = 1, lines = 0;
    let board = [], currentPiece = null, nextPiece = null;
    let dropCounter = 0, dropInterval = 1000, lastTime = 0;
    let tetrisParticles = [], tetrisKeys = {}, isPaused = false;

    // Initialize board
    function createBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    // Create piece
    function createPiece(type = Math.floor(Math.random() * 7)) {
        return {
            shape: SHAPES[type],
            color: type,
            x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
            y: 0
        };
    }

    // Draw block with gradient
    function drawBlock(x, y, colorIdx, context = tetrisCtx) {
        const gradient = context.createLinearGradient(x, y, x + BLOCK_SIZE, y + BLOCK_SIZE);
        gradient.addColorStop(0, COLORS[colorIdx][0]);
        gradient.addColorStop(1, COLORS[colorIdx][1]);

        context.fillStyle = gradient;
        context.fillRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

        // Glow effect
        context.shadowBlur = 10;
        context.shadowColor = COLORS[colorIdx][0];
        context.strokeStyle = COLORS[colorIdx][0];
        context.lineWidth = 2;
        context.strokeRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        context.shadowBlur = 0;
    }

    // Draw board
    function drawBoard() {
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    drawBlock(x * BLOCK_SIZE, y * BLOCK_SIZE, value - 1);
                }
            });
        });
    }

    // Draw piece
    function drawPiece(piece, offsetX = 0, offsetY = 0, context = tetrisCtx) {
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    drawBlock(
                        (piece.x + x) * BLOCK_SIZE + offsetX,
                        (piece.y + y) * BLOCK_SIZE + offsetY,
                        piece.color,
                        context
                    );
                }
            });
        });
    }

    // Collision detection
    function collide(piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x;
                    const newY = piece.y + y;
                    if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Merge piece to board
    function merge() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    board[currentPiece.y + y][currentPiece.x + x] = currentPiece.color + 1;
                }
            });
        });
    }

    // Rotate piece
    function rotate() {
        const rotated = currentPiece.shape[0].map((_, i) =>
            currentPiece.shape.map(row => row[i]).reverse()
        );
        const prev = currentPiece.shape;
        currentPiece.shape = rotated;
        if (collide(currentPiece)) {
            currentPiece.shape = prev;
        }
    }

    // Move piece
    function move(dir) {
        currentPiece.x += dir;
        if (collide(currentPiece)) {
            currentPiece.x -= dir;
        }
    }

    // Drop piece
    function drop() {
        currentPiece.y++;
        if (collide(currentPiece)) {
            currentPiece.y--;
            merge();
            clearLines();
            currentPiece = nextPiece;
            nextPiece = createPiece();
            if (collide(currentPiece)) {
                gameOver();
            }
        }
        dropCounter = 0;
    }

    // Hard drop
    function hardDrop() {
        while (!collide(currentPiece)) {
            currentPiece.y++;
        }
        currentPiece.y--;
        drop();
    }

    // Clear lines
    function clearLines() {
        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(cell => cell !== 0)) {
                board.splice(y, 1);
                board.unshift(Array(COLS).fill(0));
                linesCleared++;
                y++; // Check same line again

                // Create particles
                for (let i = 0; i < 20; i++) {
                    tetrisParticles.push({
                        x: Math.random() * COLS * BLOCK_SIZE,
                        y: y * BLOCK_SIZE,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5,
                        life: 1,
                        color: COLORS[Math.floor(Math.random() * 7)][0]
                    });
                }
            }
        }

        if (linesCleared > 0) {
            lines += linesCleared;
            score += [0, 100, 300, 500, 800][linesCleared] * level;
            level = Math.floor(lines / 10) + 1;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            updateHUD();
        }
    }

    // Update HUD
    function updateHUD() {
        tetrisScoreEl.textContent = score;
        tetrisLevelEl.textContent = level;
        tetrisLinesEl.textContent = lines;

        // Draw next piece
        nextCtx.fillStyle = 'rgba(0,0,0,0.3)';
        nextCtx.fillRect(0, 0, 80, 80);
        if (nextPiece) {
            const offsetX = (80 - nextPiece.shape[0].length * 20) / 2;
            const offsetY = (80 - nextPiece.shape.length * 20) / 2;
            nextPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const gradient = nextCtx.createLinearGradient(
                            offsetX + x * 20, offsetY + y * 20,
                            offsetX + x * 20 + 20, offsetY + y * 20 + 20
                        );
                        gradient.addColorStop(0, COLORS[nextPiece.color][0]);
                        gradient.addColorStop(1, COLORS[nextPiece.color][1]);
                        nextCtx.fillStyle = gradient;
                        nextCtx.fillRect(offsetX + x * 20 + 1, offsetY + y * 20 + 1, 18, 18);
                    }
                });
            });
        }
    }

    // Game over
    function gameOver() {
        gameActive = false;
        tetrisMsgText.textContent = `GAME OVER! Score: ${score}`;
        tetrisMsg.style.display = 'block';
        setTimeout(() => {
            tetrisMsg.style.display = 'none';
            tetrisLanding.style.display = 'flex';
            tetrisHUD.style.display = 'none';
        }, 3000);
    }

    // Initialize game
    function initTetris() {
        tetrisCanvas.width = COLS * BLOCK_SIZE;
        tetrisCanvas.height = ROWS * BLOCK_SIZE;

        board = createBoard();
        currentPiece = createPiece();
        nextPiece = createPiece();
        score = 0;
        level = 1;
        lines = 0;
        tetrisParticles = [];
        isPaused = false;
        gameActive = true;
        dropCounter = 0;
        lastTime = 0;

        tetrisLanding.style.display = 'none';
        tetrisHUD.style.display = 'block';
        updateHUD();
        requestAnimationFrame(tetrisLoop);
    }

    // Game loop
    function tetrisLoop(time = 0) {
        if (!gameActive) return;

        const deltaTime = time - lastTime;
        lastTime = time;

        if (!isPaused) {
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                drop();
            }
        }

        // Draw background gradient
        const bgGradient = tetrisCtx.createLinearGradient(0, 0, 0, ROWS * BLOCK_SIZE);
        bgGradient.addColorStop(0, '#0a0015');
        bgGradient.addColorStop(0.5, '#1a0a2e');
        bgGradient.addColorStop(1, '#0f0520');
        tetrisCtx.fillStyle = bgGradient;
        tetrisCtx.fillRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

        // Draw grid
        tetrisCtx.strokeStyle = 'rgba(255,255,255,0.05)';
        tetrisCtx.lineWidth = 1;
        for (let i = 0; i <= COLS; i++) {
            tetrisCtx.beginPath();
            tetrisCtx.moveTo(i * BLOCK_SIZE, 0);
            tetrisCtx.lineTo(i * BLOCK_SIZE, ROWS * BLOCK_SIZE);
            tetrisCtx.stroke();
        }
        for (let i = 0; i <= ROWS; i++) {
            tetrisCtx.beginPath();
            tetrisCtx.moveTo(0, i * BLOCK_SIZE);
            tetrisCtx.lineTo(COLS * BLOCK_SIZE, i * BLOCK_SIZE);
            tetrisCtx.stroke();
        }

        // Draw particles
        tetrisParticles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            tetrisCtx.fillStyle = p.color;
            tetrisCtx.globalAlpha = p.life;
            tetrisCtx.fillRect(p.x, p.y, 3, 3);
            if (p.life <= 0) tetrisParticles.splice(i, 1);
        });
        tetrisCtx.globalAlpha = 1;

        drawBoard();
        if (currentPiece && !isPaused) drawPiece(currentPiece);

        requestAnimationFrame(tetrisLoop);
    }

    // Controls
    window.addEventListener('keydown', e => {
        if (!gameActive || activeTab !== 'minigame') return;

        if (e.key === 'p' || e.key === 'P') {
            isPaused = !isPaused;
            tetrisMsgText.textContent = isPaused ? 'PAUSED ⏸️' : '';
            tetrisMsg.style.display = isPaused ? 'block' : 'none';
        }

        if (isPaused) return;

        if (e.key === 'ArrowLeft') move(-1);
        if (e.key === 'ArrowRight') move(1);
        if (e.key === 'ArrowDown') drop();
        if (e.key === 'ArrowUp') rotate();
        if (e.key === ' ') { hardDrop(); e.preventDefault(); }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    });

    startTetrisBtn?.addEventListener('click', initTetris);

    // Auto-pause when tab hidden or menu switched
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameActive && !isPaused) {
            isPaused = true;
            tetrisMsgText.textContent = '일시정지 ⏸️';
            tetrisMsg.style.display = 'block';
        }
    });

    // Pause when switching tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameActive && !isPaused && activeTab !== 'minigame') {
                isPaused = true;
                tetrisMsgText.textContent = '일시정지 ⏸️';
                tetrisMsg.style.display = 'block';
            }
        });
    });

    // Start stock refresh automatically
    startStockRefresh();

    // Global cursor tracking
    document.addEventListener('mousemove', e => {
        if (auraCursor) {
            auraCursor.style.left = `${e.clientX}px`;
            auraCursor.style.top = `${e.clientY}px`;
        }
        document.querySelectorAll('.gallery-item').forEach(c => {
            const r = c.getBoundingClientRect();
            c.style.setProperty('--mouseX', `${e.clientX - r.left}px`);
            c.style.setProperty('--mouseY', `${e.clientY - r.top}px`);
        });
    });
});
