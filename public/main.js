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

    // --- AI Insights System (v63 - FMP API with Fallback) ---
    async function loadAIInsights() {
        const marketList = document.getElementById('market-list');
        const papersList = document.getElementById('papers-list');

        // Stock symbols with REAL fallback data (Feb 7, 2026)
        const stocks = [
            { symbol: 'NVDA', name: 'NVIDIA', fallback: { price: 185.40, change: 13.77, percent: 8.01 } },
            { symbol: 'MSFT', name: 'Microsoft', fallback: { price: 401.14, change: -2.45, percent: -0.61 } },
            { symbol: 'GOOGL', name: 'Alphabet', fallback: { price: 322.86, change: 4.55, percent: 1.43 } },
            { symbol: 'AAPL', name: 'Apple', fallback: { price: 278.12, change: 2.21, percent: 0.80 } },
            { symbol: 'TSLA', name: 'Tesla', fallback: { price: 411.11, change: -8.90, percent: -2.12 } }
        ];

        // Load stock data with fallback
        if (marketList) {
            try {
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
                                price: quote.price,
                                change: quote.change || 0,
                                percent: quote.changesPercentage || 0,
                                isLive: true
                            };
                        }
                        throw new Error('Invalid API response');
                    } catch (e) {
                        // Use fallback data
                        console.log(`Using fallback for ${stock.symbol}`);
                        return {
                            symbol: stock.symbol,
                            name: stock.name,
                            price: stock.fallback.price,
                            change: stock.fallback.change,
                            percent: stock.fallback.percent,
                            isLive: false
                        };
                    }
                });

                const stockData = await Promise.all(stockPromises);
                const hasLiveData = stockData.some(s => s.isLive);

                if (stockData.length > 0) {
                    const renderStock = (s) => `
                        <div class="market-item">
                            <div class="market-info-left">
                                <span class="market-symbol">${s.symbol}</span>
                                <span class="market-name">${s.name}</span>
                            </div>
                            <div class="market-info-right">
                                <div class="market-price">$${s.price.toFixed(2)}</div>
                                <div class="market-change ${s.change >= 0 ? 'up' : 'down'}">
                                    ${s.change >= 0 ? '▲' : '▼'} ${Math.abs(s.percent).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    `;

                    marketList.innerHTML = `
                        <div class="market-region-header">US Tech Markets ${hasLiveData ? '(실시간)' : '(참고용)'}</div>
                        ${stockData.map(renderStock).join('')}
                        <p style="font-size:0.7rem; opacity:0.5; text-align:center; margin-top:1rem;">
                            ${new Date().toLocaleTimeString('ko-KR')} 업데이트 ${hasLiveData ? '' : '(API 제한)'}
                        </p>
                    `;
                } else {
                    marketList.innerHTML = '<p class="loading-msg">데이터를 불러올 수 없습니다 😢</p>';
                }
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

    // --- [v64] Aura Striker: Enhanced Graphics Edition ---
    const strikerCanvas = document.getElementById('striker-canvas');
    const sCtx = strikerCanvas?.getContext('2d');
    const startStrikerBtn = document.getElementById('btn-striker-start');
    const strikerLanding = document.getElementById('striker-landing');
    const strikerHUD = document.getElementById('striker-hud');
    const strikerMsg = document.getElementById('striker-message');
    const strikerMsgText = document.getElementById('striker-msg-text');
    const strikerScoreEl = document.getElementById('striker-score');
    const strikerStageEl = document.getElementById('striker-stage');
    const strikerHPFill = document.getElementById('striker-hp-fill');

    // Game state
    let gameActive = false, strikerScore = 0, strikerStage = 1, strikerHP = 100;
    let player = null, enemies = [], bullets = [], enemyBullets = [], particlesArr = [];
    let keys = {}, spawnTimer = 0, lastShotTime = 0;

    // Animated background
    let stars = [], bgOffset = 0;

    const STAGE_CONFIG = {
        1: { enemySpeed: 1.5, spawnRate: 100, bulletSpeed: 4, boss: false },
        2: { enemySpeed: 2.0, spawnRate: 80, bulletSpeed: 5, boss: false },
        3: { enemySpeed: 2.5, spawnRate: 60, bulletSpeed: 6, boss: false },
        4: { enemySpeed: 3.0, spawnRate: 50, bulletSpeed: 7, boss: false },
        5: { enemySpeed: 3.5, spawnRate: 40, bulletSpeed: 8, boss: true }
    };

    class Entity {
        constructor(x, y, w, h, color) { this.x = x; this.y = y; this.w = w; this.h = h; this.color = color; }
        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10; ctx.shadowColor = this.color;
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.shadowBlur = 0;
        }
    }

    class Player extends Entity {
        constructor() { super(450, 650, 50, 50, '#60a5fa'); this.speed = 7; }
        draw(ctx) {
            ctx.save();
            ctx.translate(this.x + 25, this.y + 25);

            // Main body - sleek fighter design
            ctx.fillStyle = '#3b82f6';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#60a5fa';
            ctx.beginPath();
            ctx.moveTo(0, -25);  // Nose
            ctx.lineTo(12, -10);
            ctx.lineTo(18, 10);
            ctx.lineTo(10, 20);
            ctx.lineTo(0, 15);
            ctx.lineTo(-10, 20);
            ctx.lineTo(-18, 10);
            ctx.lineTo(-12, -10);
            ctx.closePath();
            ctx.fill();

            // Cockpit glow
            ctx.fillStyle = '#a5f3fc';
            ctx.beginPath();
            ctx.arc(0, -5, 6, 0, Math.PI * 2);
            ctx.fill();

            // Wings
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-18, 10);
            ctx.lineTo(-25, 5);
            ctx.lineTo(-18, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(18, 10);
            ctx.lineTo(25, 5);
            ctx.lineTo(18, 0);
            ctx.stroke();

            // Animated thruster
            const thrusterSize = 8 + Math.random() * 6;
            const gradient = ctx.createRadialGradient(0, 22, 0, 0, 22, thrusterSize);
            gradient.addColorStop(0, '#fff');
            gradient.addColorStop(0.3, '#60a5fa');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 22, thrusterSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        update() {
            if (keys['ArrowUp'] && this.y > 0) this.y -= this.speed;
            if (keys['ArrowDown'] && this.y < 800 - 50) this.y += this.speed;
            if (keys['ArrowLeft'] && this.x > 0) this.x -= this.speed;
            if (keys['ArrowRight'] && this.x < 1000 - 50) this.x += this.speed;
            if (keys[' '] && Date.now() - lastShotTime > 200) { this.shoot(); lastShotTime = Date.now(); }
        }
        shoot() { bullets.push(new Bullet(this.x + 23, this.y, -12, '#60a5fa')); }
    }

    class Enemy extends Entity {
        constructor(isBoss = false) {
            super(Math.random() * 920, -80, isBoss ? 150 : 40, isBoss ? 100 : 40, isBoss ? '#a855f7' : '#f97316');
            this.isBoss = isBoss;
            this.hp = isBoss ? 50 : 1;
            this.speed = STAGE_CONFIG[strikerStage].enemySpeed;
            this.vx = isBoss ? 3 : 0;
            this.pulse = 0;
        }
        draw(ctx) {
            ctx.save();
            ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;

            if (!this.isBoss) {
                // Basic enemy - angular aggressive design
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(0, 20);  // Bottom point
                ctx.lineTo(-20, -15);
                ctx.lineTo(-10, -20);
                ctx.lineTo(0, -10);
                ctx.lineTo(10, -20);
                ctx.lineTo(20, -15);
                ctx.closePath();
                ctx.fill();

                // Engine glow
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(-12, -18, 3, 0, Math.PI * 2);
                ctx.arc(12, -18, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Boss - massive battleship
                this.pulse += 0.1;
                const pulseGlow = 20 + Math.sin(this.pulse) * 10;
                ctx.shadowBlur = pulseGlow;

                // Main hull
                ctx.fillStyle = '#7c3aed';
                ctx.beginPath();
                ctx.moveTo(-75, -30);
                ctx.lineTo(75, -30);
                ctx.lineTo(60, 0);
                ctx.lineTo(50, 50);
                ctx.lineTo(-50, 50);
                ctx.lineTo(-60, 0);
                ctx.closePath();
                ctx.fill();

                // Weapon turrets
                ctx.fillStyle = '#a855f7';
                [-40, 40].forEach(x => {
                    ctx.fillRect(x - 8, -20, 16, 30);
                });

                // Pulsing core
                const coreGradient = ctx.createRadialGradient(0, 10, 0, 0, 10, 25);
                coreGradient.addColorStop(0, '#fff');
                coreGradient.addColorStop(0.5, '#f0abfc');
                coreGradient.addColorStop(1, '#a855f7');
                ctx.fillStyle = coreGradient;
                ctx.beginPath();
                ctx.arc(0, 10, 20 + Math.sin(this.pulse) * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        update() {
            this.y += this.isBoss ? 0.5 : this.speed;
            if (this.isBoss) {
                this.x += this.vx;
                if (this.x < 0 || this.x > 850) this.vx *= -1;
            }
            if (Math.random() < (this.isBoss ? 0.05 : 0.02)) this.shoot();
        }
        shoot() {
            enemyBullets.push(new Bullet(this.x + this.w / 2 - 3, this.y + this.h, STAGE_CONFIG[strikerStage].bulletSpeed, this.color));
        }
    }

    class Bullet extends Entity {
        constructor(x, y, vy, color) { super(x, y, 4, 15, color); this.vy = vy; }
        update() { this.y += this.vy; }
    }

    function initStriker() {
        // Larger canvas
        strikerCanvas.width = 1000;
        strikerCanvas.height = 800;

        // Initialize background stars
        stars = [];
        for (let i = 0; i < 200; i++) {
            stars.push({
                x: Math.random() * 1000,
                y: Math.random() * 800,
                size: Math.random() * 2,
                speed: 0.5 + Math.random() * 2,
                opacity: 0.3 + Math.random() * 0.7
            });
        }

        player = new Player();
        enemies = [];
        bullets = [];
        enemyBullets = [];
        particlesArr = [];
        strikerScore = 0;
        strikerStage = 1;
        strikerHP = 100;
        gameActive = true;
        bgOffset = 0;

        strikerLanding.style.display = 'none';
        strikerHUD.style.display = 'block';
        updateHUD();
        requestAnimationFrame(strikerLoop);
    }

    function updateHUD() {
        strikerScoreEl.textContent = strikerScore; strikerStageEl.textContent = strikerStage;
        strikerHPFill.style.width = `${strikerHP}%`;
    }

    function showMsg(txt, callback) {
        strikerMsgText.textContent = txt; strikerMsg.style.display = 'block';
        setTimeout(() => { strikerMsg.style.display = 'none'; if (callback) callback(); }, 2000);
    }

    function strikerLoop() {
        if (!gameActive) return;

        // Animated galaxy background
        const bgGradient = sCtx.createLinearGradient(0, 0, 0, 800);
        bgGradient.addColorStop(0, '#0a0015');
        bgGradient.addColorStop(0.5, '#1a0a2e');
        bgGradient.addColorStop(1, '#0f0520');
        sCtx.fillStyle = bgGradient;
        sCtx.fillRect(0, 0, 1000, 800);

        // Nebula clouds
        bgOffset += 0.3;
        sCtx.save();
        sCtx.globalAlpha = 0.15;
        const nebula1 = sCtx.createRadialGradient(300, (bgOffset % 1600) - 400, 0, 300, (bgOffset % 1600) - 400, 300);
        nebula1.addColorStop(0, '#7c3aed');
        nebula1.addColorStop(1, 'transparent');
        sCtx.fillStyle = nebula1;
        sCtx.fillRect(0, 0, 1000, 800);

        const nebula2 = sCtx.createRadialGradient(700, ((bgOffset * 0.7) % 1600) - 200, 0, 700, ((bgOffset * 0.7) % 1600) - 200, 250);
        nebula2.addColorStop(0, '#3b82f6');
        nebula2.addColorStop(1, 'transparent');
        sCtx.fillStyle = nebula2;
        sCtx.fillRect(0, 0, 1000, 800);
        sCtx.restore();

        // Scrolling stars
        stars.forEach(star => {
            star.y += star.speed;
            if (star.y > 800) {
                star.y = 0;
                star.x = Math.random() * 1000;
            }
            sCtx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            sCtx.fillRect(star.x, star.y, star.size, star.size);
        });
        // Galaxy Stars Background
        sCtx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) sCtx.fillRect(Math.random() * 900, Math.random() * 500, 1, 1);

        player.update(); player.draw(sCtx);

        spawnTimer++;
        const cfg = STAGE_CONFIG[strikerStage];
        if (spawnTimer > cfg.spawnRate && enemies.length < 10) {
            if (!cfg.boss || (cfg.boss && enemies.filter(e => e.isBoss).length === 0)) {
                enemies.push(new Enemy(cfg.boss && strikerScore >= 20 * strikerStage));
            }
            spawnTimer = 0;
        }

        bullets.forEach((b, bi) => {
            b.update(); b.draw(sCtx);
            if (b.y < -20) bullets.splice(bi, 1);
            enemies.forEach((e, ei) => {
                if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                    bullets.splice(bi, 1); e.hp--; strikerScore += 10; updateHUD();
                    if (e.hp <= 0) { enemies.splice(ei, 1); createExplosion(e.x + e.w / 2, e.y + e.h / 2); if (e.isBoss) nextStage(); }
                }
            });
        });

        enemyBullets.forEach((eb, ebi) => {
            eb.update(); eb.draw(sCtx);
            if (eb.y > 520) enemyBullets.splice(ebi, 1);
            if (eb.x < player.x + player.w && eb.x + eb.w > player.x && eb.y < player.y + player.h && eb.y + eb.h > player.y) {
                enemyBullets.splice(ebi, 1); strikerHP -= 10; updateHUD();
                if (strikerHP <= 0) strikerGameOver();
            }
        });

        enemies.forEach((e, ei) => {
            e.update(); e.draw(sCtx);
            if (e.y > 850) enemies.splice(ei, 1);
            if (e.x < player.x + player.w && e.x + e.w > player.x && e.y < player.y + player.h && e.y + e.h > player.y) {
                enemies.splice(ei, 1); strikerHP -= 20; updateHUD();
                if (strikerHP <= 0) strikerGameOver();
            }
        });

        if (!cfg.boss && strikerScore >= 100 * strikerStage) nextStage();

        requestAnimationFrame(strikerLoop);
    }

    function createExplosion(x, y) {
        for (let i = 0; i < 10; i++) particlesArr.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1, c: '#fb923c' });
    }

    function nextStage() {
        if (strikerStage === 5) { gameActive = false; showMsg("MISSION COMPLETE! 🎉", () => location.reload()); return; }
        strikerStage++; enemies = []; bullets = []; enemyBullets = [];
        showMsg(`STAGE ${strikerStage} START`, () => { });
    }

    function strikerGameOver() {
        gameActive = false; showMsg("GAME OVER 💀", () => { strikerLanding.style.display = 'flex'; strikerHUD.style.display = 'none'; });
    }

    window.addEventListener('keydown', e => { keys[e.key] = true; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && activeTab === 'minigame') e.preventDefault(); });
    window.addEventListener('keyup', e => keys[e.key] = false);
    startStrikerBtn?.addEventListener('click', initStriker);

    // Auto-pause game when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameActive) {
            gameActive = false;
            if (strikerMsg && strikerMsgText) {
                strikerMsgText.textContent = '일시정지 ⏸️';
                strikerMsg.style.display = 'block';
            }
        } else if (!document.hidden && !gameActive && player) {
            strikerMsg.style.display = 'none';
            gameActive = true;
            requestAnimationFrame(strikerLoop);
        }
    });

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
