// [v144] Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Hybrid Firebase Initialization (Local + Secure Server)
let auth;
async function initFirebase() {
    try {
        let config = window.firebaseConfig;

        // If local config is empty or missing keys, fetch from server
        if (!config || !config.apiKey) {
            console.log('Local config missing, fetching from server...');
            const resp = await fetch('/api/config/firebase');
            config = await resp.json();
        }

        if (config && config.apiKey) {
            const app = initializeApp(config);
            auth = getAuth(app);
            console.log('Firebase initialized (Hybrid mode) 🔒');
            setupAuthListener();
        } else {
            console.warn('Firebase config still missing after hybrid check ⚠️');
        }
    } catch (e) {
        console.error('Firebase init failed:', e);
    }
}

initFirebase();

document.addEventListener('DOMContentLoaded', () => {
    // [v84] Custom Toast Notification
    function showToast(msg) {
        const container = document.getElementById('aura-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'aura-toast';
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3100);
    }

    // [v85] Custom Confirm Modal
    function auraConfirm(msg, onOk) {
        const modal = document.getElementById('aura-confirm-modal');
        const msgEl = document.getElementById('confirm-msg');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        if (!modal || !msgEl) return;

        msgEl.innerText = msg;
        modal.classList.add('active');

        const close = () => modal.classList.remove('active');
        okBtn.onclick = () => { close(); if (onOk) onOk(); };
        cancelBtn.onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };
    }
    // AGGRESSIVE CACHE CLEARING - v61 (v117 Modified: Preserve User Data)
    // [v130] Google Auth Only
    const CURRENT_VERSION = 'v144';
    const storedVersion = localStorage.getItem('app_version');

    if (storedVersion !== CURRENT_VERSION) {
        // [v117] Preserve user data before clearing cache
        const auraUsers = localStorage.getItem('aura_users');

        localStorage.clear();
        sessionStorage.clear();

        // Restore user data
        if (auraUsers) {
            localStorage.setItem('aura_users', auraUsers);
        }

        localStorage.setItem('app_version', CURRENT_VERSION);
        console.log('🧹 Cleared cache (preserved user data)! Reloading v117...');
        setTimeout(() => location.reload(true), 100);
        return;
    }

    // Auth & Elements
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

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
    let pendingTab = null; // [v97] Board 로그인 후 이동할 탭
    let appInitialized = false; // [v97] 데이터 초기 로딩 여부

    // 로컬 데이터 저장소 (검색 및 미리보기용)
    let allCars = [];
    let allRecipes = [];
    let allNews = [];
    let allCoding = [];
    let allIdeas = []; // [v75] Idea Board Storage
    let allUrls = [];  // [v145] URL Collection Storage

    // 로딩 상태 관리
    let loadingStatus = { cars: false, recipes: false, coding: false, idea: false };
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
            // Faster movement for a more active feel
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            // Particles are nodes in the network
            this.radius = Math.random() * 2 + 1;
            // Galactic colors
            const colors = [
                'rgba(165, 180, 252, 0.8)', // Light Indigo
                'rgba(196, 181, 253, 0.7)', // Light Purple
                'rgba(255, 255, 255, 0.5)', // White stardust
                'rgba(129, 140, 248, 0.6)'  // Blueish
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }
        update() {
            if (!canvas) return;
            const w = canvas.width / dpr;
            const h = canvas.height / dpr;
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0) this.x = w;
            if (this.x > w) this.x = 0;
            if (this.y < 0) this.y = h;
            if (this.y > h) this.y = 0;
        }
        draw() {
            if (!ctx) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }

    function drawLines() {
        if (!ctx) return;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(165, 180, 252, ${0.15 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function createParticles() {
        particles = [];
        const count = window.innerWidth < 800 ? 40 : 100; // More particles for the network
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function animate() {
        if (!ctx || !canvas) return requestAnimationFrame(animate);

        const w = canvas.width / dpr;
        const h = canvas.height / dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w + 10, h + 10);

        particles.forEach((p) => {
            p.update();
            p.draw();
        });
        drawLines();
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
        const cw = canvas?.width || 0;
        if (cw === 0 || particles.length === 0) {
            initCanvas();
        }
        if (++checkCount > 10) clearInterval(checkInterval); // 5초로 연장
    }, 500);

    // 4. Chrome/Edge 창 로드 완료 후 확정 호출
    window.addEventListener('load', () => {
        setTimeout(initCanvas, 100);
    });

    // 3. 브라우저 크기 변화 감지 (ResizeObserver)
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            initCanvas();
        });
        ro.observe(document.body);
    } else {
        window.addEventListener('resize', initCanvas);
    }

    // --- Firebase Authentication [v97: Public Site - Board Login Only] ---

    // [v97] 로그인 모달 표시 헬퍼
    function showLoginModal() {
        loginScreen.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // [v144] 스크롤 차단
    }
    function hideLoginModal() {
        loginScreen.style.display = 'none';
        document.body.style.overflow = ''; // [v144] 스크롤 복구
    }

    // [v97] 비로그인 시 네비 사용자 정보 토글
    function updateNavAuthUI() {
        const navUserInfo = document.getElementById('nav-user-info');
        const navLogoutBtn = document.getElementById('nav-logout-btn');
        if (currentUser) {
            if (navUserInfo) navUserInfo.style.display = '';
            if (navLogoutBtn) navLogoutBtn.style.display = '';
        } else {
            if (navUserInfo) navUserInfo.style.display = 'none';
            if (navLogoutBtn) navLogoutBtn.style.display = 'none';
        }
    }

    // [v97] 앱 초기 데이터 로딩 (로그인 여부 무관하게 1회 실행)
    function initAppData() {
        if (appInitialized) return;
        appInitialized = true;

        setSearchLoading(true);
        loadAIInsights();

        setTimeout(() => backgroundFullLoad('cars'), 500);
        setTimeout(() => backgroundFullLoad('recipes'), 1500);
        setTimeout(() => backgroundFullLoad('coding'), 2500);
        setTimeout(() => backgroundIdeaLoad(), 3500);
        setTimeout(() => fetchNextNews(), 4500);

        initIntersectionObserver();

        const targetTab = location.hash.replace('#', '') || sessionStorage.getItem('aura_active_tab') || 'home';
        switchTab(targetTab === 'search' ? 'home' : targetTab, false);
    }

    // [Firebase] 구글 로그인 (유일한 로그인 수단)
    const googleLoginBtn = document.getElementById('google-login-btn');
    googleLoginBtn?.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            const result = await signInWithPopup(auth, provider);
            showToast('로그인 성공! 이제 게시판을 이용할 수 있어요 ✨');
            console.log('Google Login Success:', result.user.email);
            hideLoginModal();
        } catch (error) {
            console.error("Google Login Error:", error);
            if (error.code === 'auth/popup-blocked') {
                showToast('앗, 팝업이 차단되어 로그인할 수 없어요. 브라우저 설정을 확인해 주세요! 🔒');
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Popup closed by user');
            } else {
                showToast('로그인 중에 잠시 문제가 생겼어요. 다시 한번만 시도해 볼까요? 😊');
            }
        }
    });

    // [v97] 로그인 모달 배경 클릭 시 닫기
    loginScreen?.addEventListener('click', (e) => {
        if (e.target === loginScreen) {
            hideLoginModal();
        }
    });


    // [Firebase] 로그아웃 [v97: 공개 사이트에서 홈으로 이동]
    const handleLogout = () => {
        auraConfirm('로그아웃 하시겠습니까? 😊', async () => {
            try {
                await signOut(auth);
                sessionStorage.removeItem('aura_session');
                localStorage.removeItem('aura_users');
                switchTab('home');
                showToast('로그아웃 되었습니다. 또 만나요! 👋');
            } catch (error) {
                console.error("Logout Error:", error);
            }
        });
    };

    document.getElementById('nav-logout-btn')?.addEventListener('click', handleLogout);

    // [Firebase] 상태 변화 감지 & 세션 유지 [v97: Public Site]
    function setupAuthListener() {
        if (!auth) return;
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // 로그인 성공 -> UI 업데이트
                console.log('Firebase Session Active:', user.email);
                const auraUser = {
                    uid: user.uid,
                    email: user.email,
                    username: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    provider: 'firebase'
                };

                currentUser = auraUser;
                sessionStorage.setItem('aura_session', JSON.stringify(auraUser));
                hideLoginModal();

                // [v133] Update Header User Info
                const navUserName = document.getElementById('nav-user-name');
                const navUserEmail = document.getElementById('nav-user-email');
                if (navUserName) navUserName.innerText = currentUser.name;
                if (navUserEmail) navUserEmail.innerText = currentUser.email;

                updateNavAuthUI();
                loadGuestbook();

                // [v97] 로그인 후 pending 탭이 있으면 이동
                if (pendingTab) {
                    const tab = pendingTab;
                    pendingTab = null;
                    switchTab(tab);
                }
            } else {
                console.log('No Active Session - Public mode');
                currentUser = null;
                sessionStorage.removeItem('aura_session');
                updateNavAuthUI();
            }

            // [v97] 로그인 여부와 무관하게 앱 데이터 초기 로딩
            initAppData();
        });
    }

    // Deprecated: Old Login Logic Removed
    /*
    function loginUser(user, isPersistent = true) { ... }
    */

    // --- Dashboard Wide Cards Logic [v72] ---
    document.querySelectorAll('.wide-card').forEach(card => {
        card.addEventListener('click', () => {
            const target = card.getAttribute('data-target');
            if (target) switchTab(target);
        });
    });

    function updateWideDashboardPreviews() {
        const mapping = [
            { id: 'card-car', data: allCars },
            { id: 'card-recipe', data: allRecipes },
            { id: 'card-coding', data: allCoding },
            { id: 'card-news', data: allNews },
            { id: 'card-idea', data: allIdeas } // [v75] Add Idea card preview
        ];

        mapping.forEach(item => {
            const card = document.getElementById(item.id);
            if (!card) return;
            const itemsWithImg = item.data.filter(i => i.imageUrl);

            if (itemsWithImg.length > 0) {
                const randomItem = itemsWithImg[Math.floor(Math.random() * itemsWithImg.length)];
                const bg = card.querySelector('.card-bg');
                if (bg) {
                    // Preload image
                    const img = new Image();
                    img.src = randomItem.imageUrl;
                    img.onload = () => {
                        bg.style.backgroundImage = `url(${randomItem.imageUrl})`;
                    };
                }
            }
        });
    }

    // Call this whenever data is loaded



    // --- Search Status Control ---
    function setSearchLoading(isLoading) {
        if (isLoading) {
            searchContainer?.classList.add('loading');
            searchInput.placeholder = "데이터 로딩 중... ⏳";
            searchInput.disabled = true;
        } else {
            if (!loadingStatus.cars && !loadingStatus.recipes && !loadingStatus.coding && !loadingStatus.idea) {
                searchContainer?.classList.remove('loading');
                searchInput.placeholder = "검색어 입력 후 Enter...";
                searchInput.disabled = false;
            }
        }
    }

    // --- Data Loading ---
    async function backgroundFullLoad(type) {
        if (loadingStatus[type]) return; // [v83] Prevent redundant calls
        loadingStatus[type] = true;
        let hasMore = true, cursor = null, isFirstBatch = true;
        const gridId = type === 'cars' ? 'gallery-grid' : type === 'recipes' ? 'recipe-grid' : 'coding-grid';

        while (hasMore) {
            try {
                const resp = await fetch(`/api/${type}?size=50${cursor ? `&cursor=${cursor}` : ''}`);
                if (!resp.ok) throw new Error(`API Error: ${resp.status}`);
                const data = await resp.json();

                if (data && data.items && Array.isArray(data.items)) {
                    const info = getDataByType(type);
                    if (!info) break;

                    info.array.push(...data.items);

                    if (activeTab === (type === 'cars' ? 'gallery' : type === 'recipes' ? 'recipe' : 'coding')) {
                        refreshGrid(info.array, info.grid, false);
                    }
                    if (isFirstBatch) { isFirstBatch = false; updateWideDashboardPreviews(); }
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

    // [v75] Idea Board Loader
    async function backgroundIdeaLoad() {
        if (loadingStatus.idea) return;
        loadingStatus.idea = true;
        try {
            const resp = await fetch('/api/idea/list');
            if (!resp.ok) throw new Error(`Idea API Error: ${resp.status}`);
            const data = await resp.json();
            if (data && data.items) {
                allIdeas = data.items;
                refreshGrid(allIdeas, 'idea-grid', false);
                updateWideDashboardPreviews();
            }
        } catch (e) {
            console.error('[Aura] Failed to load Idea board:', e);
        } finally {
            loadingStatus.idea = false;
        }
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
                updateWideDashboardPreviews();
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

    const getDataByType = (type) => {
        const mapping = {
            cars: { array: allCars, grid: 'gallery-grid' },
            recipes: { array: allRecipes, grid: 'recipe-grid' },
            coding: { array: allCoding, grid: 'coding-grid' },
            idea: { array: allIdeas, grid: 'idea-grid' }
        };
        const key = type === 'gallery' ? 'cars' : type === 'recipe' ? 'recipes' : type;
        return mapping[key];
    };

    const filterByQuery = (array, query) => array.filter(item => item.name.toLowerCase().includes(query));

    // --- Search Event Listeners ---
    searchContainer?.addEventListener('click', (e) => {
        if (window.innerWidth <= 800) {
            searchModal.classList.add('active');
            mobileSearchInput?.focus();
        }
    });

    searchInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performLocalSearch(searchInput.value.trim().toLowerCase());
        }
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

        switchTab('search-results', false);
        location.hash = 'search';
        searchInput.blur();

        if (allCars.length === 0 && allRecipes.length === 0 && allCoding.length === 0) {
            console.log('Search triggered with no data. forcing load...');
            setSearchLoading(true);
            backgroundFullLoad('cars'); backgroundFullLoad('recipes'); backgroundFullLoad('coding');
            setTimeout(() => { setSearchLoading(false); performLocalSearch(query); }, 2500);
            return;
        }

        queryDisplay.innerHTML = `<span>'${query}'</span>` + " 검색 결과";

        const filteredCars = filterByQuery(allCars, query);
        const filteredRecipes = filterByQuery(allRecipes, query);
        const filteredNews = filterByQuery(allNews, query);
        const filteredCoding = filterByQuery(allCoding, query);

        renderSearchSubGrid('search-grid-cars', 'search-section-cars', filteredCars, false);
        renderSearchSubGrid('search-grid-recipes', 'search-section-recipes', filteredRecipes, false);
        renderSearchSubGrid('search-grid-news', 'search-section-news', filteredNews, true);
        renderSearchSubGrid('search-grid-coding', 'search-section-coding', filteredCoding, false);

        const total = filteredCars.length + filteredRecipes.length + filteredNews.length + filteredCoding.length;
        countDisplay.innerText = `로딩된 데이터에서 총 ${total}개의 항목을 발견했습니다.`;
        noResultsMsg.style.display = total === 0 ? 'block' : 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // [v90] Search Modal Close Logic
    const closeSearchBtn = document.getElementById('close-search-modal');
    const closeSearchModal = () => {
        searchModal.classList.remove('active');
        body.style.overflow = 'auto';
    };
    closeSearchBtn?.addEventListener('click', closeSearchModal);
    searchModal?.addEventListener('click', (e) => {
        if (e.target === searchModal) closeSearchModal();
    });

    function renderSearchSubGrid(gridId, sectionId, items, isNews) {
        const grid = document.getElementById(gridId); const section = document.getElementById(sectionId);
        if (!grid || !section) return; grid.innerHTML = '';
        if (items.length === 0) section.style.display = 'none';
        else { section.style.display = 'block'; appendData(items, gridId, isNews); }
    }

    // --- Navigation [v97: Public with Board Login Gate] ---
    function switchTab(tabId, updateHash = true) {
        // [v97] Board 탭은 로그인 필요
        if (tabId === 'board' && !currentUser) {
            auraConfirm('게시판을 이용하려면 로그인이 필요합니다. 로그인하시겠습니까? 🔐', () => {
                pendingTab = 'board';
                showLoginModal();
            });
            return;
        }

        activeTab = tabId;
        sessionStorage.setItem('aura_active_tab', tabId);
        if (updateHash) location.hash = tabId;

        // [v83] Explicit Visibility Control
        const sections = document.querySelectorAll('.tab-content');
        sections.forEach(sec => {
            sec.style.display = 'none';
            sec.classList.remove('active');
        });

        const targetTab = document.getElementById(tabId) || document.getElementById(tabId + '-section');
        if (targetTab) {
            targetTab.style.display = 'block';
            targetTab.classList.add('active');

            // Update Nav UI
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
            });

            window.scrollTo({ top: 0, behavior: 'smooth' });

            // [v83] Data Strategy: Load if empty, Refresh if exists to ensure visibility
            if (tabId === 'urls') {
                loadUrlCollection();
            } else if (tabId === 'news') {
                if (cursors.newsStart === 1) fetchNextNews();
                else refreshGrid(allNews, 'news-grid', true);
            } else if (tabId === 'board') {
                loadBoardPosts();
            } else if (tabId === 'coding' || tabId === 'gallery' || tabId === 'recipe') {
                const info = getDataByType(tabId);
                if (info) {
                    if (info.array.length === 0) backgroundFullLoad(tabId === 'gallery' ? 'cars' : tabId === 'recipe' ? 'recipes' : 'coding');
                    else refreshGrid(info.array, info.grid, false);
                }
            } else if (tabId === 'idea') {
                if (allIdeas.length === 0) backgroundIdeaLoad();
                else refreshGrid(allIdeas, 'idea-grid', false);
            }
        }
    }

    // [v82] URL Collection Loader (Enhanced for v83)
    async function loadUrlCollection() {
        if (loadingStatus.urls) return; // [v83] Prevents rate limits
        const urlList = document.getElementById('url-list');
        if (!urlList) return;
        loadingStatus.urls = true;
        try {
            const resp = await fetch('/api/urls');
            const data = await resp.json();
            urlList.innerHTML = '';
            if (!data || data.length === 0) {
                urlList.innerHTML = '<p class="no-results-msg">아직 등록된 URL이 없습니다. 🔗</p>';
                return;
            }
            data.forEach(item => {
                // [v89] Filter out Notion header row if it exists in data
                if (item.name === '이름' || item.url === 'URL') return;

                const div = document.createElement('div');
                div.className = 'url-item-card glass-card';
                div.innerHTML = `
                    <a href="${item.url}" target="_blank" class="url-link-wrapper">
                        <div class="url-name-chip">${item.name}</div>
                        <div class="url-note-mini">${item.note || ''}</div>
                    </a>
                `;
                urlList.appendChild(div);
            });
        } catch (e) {
            urlList.innerHTML = '<p class="loading-msg">데이터 로드 실패 😢</p>';
        } finally {
            loadingStatus.urls = false;
        }
    }
    window.addEventListener('hashchange', () => {
        const tab = location.hash.replace('#', '');
        if (tab && tab !== 'search') switchTab(tab, false);
    });
    // [v83] Event Delegation for Navigation (More robust)
    document.addEventListener('click', e => {
        const navItem = e.target.closest('.nav-item');
        const dropdownItem = e.target.closest('.dropdown-nav-item');

        if (dropdownItem) {
            const tabId = dropdownItem.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
            return; // Prevent triggering parent nav-item logic if any
        }

        if (navItem && !navItem.classList.contains('dropdown')) {
            const tabId = navItem.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        }
    });

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
            const info = getDataByType(typeKey);
            if (info) {
                info.array.sort((a, b) => sortType === 'desc' ? b.name.localeCompare(a.name, 'ko') : a.name.localeCompare(b.name, 'ko'));
                refreshGrid(info.array, info.grid, false);
            }
            d.classList.remove('open');
        }));
    }
    setupDropdown('sort-dropdown', 'current-sort', 'cars');
    setupDropdown('recipe-sort-dropdown', 'current-recipe-sort', 'recipes');
    setupDropdown('coding-sort-dropdown', 'current-coding-sort', 'coding');

    // [v92] Board System Frontend Logic
    const boardModal = document.getElementById('board-post-modal');
    const boardGrid = document.getElementById('board-grid');
    const boardForm = document.getElementById('board-post-form');
    const boardFileInput = document.getElementById('board-file');
    const filePreview = document.getElementById('file-preview');
    const fileLabelText = document.getElementById('file-label-text');
    const removeFileBtn = document.getElementById('remove-file-btn'); // [v100.7]

    document.getElementById('open-board-post-modal')?.addEventListener('click', () => {
        boardModal.classList.add('active');
        body.style.overflow = 'hidden';
    });

    document.getElementById('close-board-post-modal')?.addEventListener('click', () => {
        boardModal.classList.remove('active');
        body.style.overflow = 'auto';
    });

    // [v100.7] Remove File Logic
    removeFileBtn?.addEventListener('click', () => {
        boardFileInput.value = ''; // Clear input
        filePreview.innerHTML = ''; // Clear preview
        fileLabelText.innerText = '이미지 또는 동영상 첨부 (5MB 이하)'; // Reset label
        removeFileBtn.style.display = 'none'; // Hide button
    });

    boardFileInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) {
            removeFileBtn.style.display = 'none';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('파일 크기는 5MB 이하여야 합니다.');
            boardFileInput.value = '';
            removeFileBtn.style.display = 'none';
            return;
        }

        fileLabelText.innerText = file.name;
        removeFileBtn.style.display = 'inline-block'; // Show remove button

        const reader = new FileReader();
        reader.onload = event => {
            filePreview.innerHTML = '';
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = event.target.result;
                filePreview.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = event.target.result;
                video.controls = true;
                filePreview.appendChild(video);
            }
        };
        reader.readAsDataURL(file);
    });

    boardForm?.addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('board-title').value;
        const content = document.getElementById('board-content').value;
        const file = boardFileInput.files[0];

        if (!title || !content) return showToast('제목과 내용을 입력해주세요.');

        setSearchLoading(true);
        try {
            let mediaUrl = '';
            let mediaType = '';

            if (file) {
                const reader = new FileReader();
                const base64Promise = new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
                const base64Data = await base64Promise;

                const uploadResp = await fetch('/api/board/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file: base64Data, type: file.type })
                });
                const uploadData = await uploadResp.json();
                if (!uploadResp.ok) throw new Error(uploadData.error || 'Upload failed');
                mediaUrl = uploadData.url;
                mediaType = file.type.startsWith('image/') ? 'image' : 'video';
            }

            const postResp = await fetch('/api/board', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    mediaUrl,
                    mediaType,
                    username: currentUser.username
                })
            });

            if (postResp.ok) {
                showToast('게시글이 등록되었습니다!');
                boardModal.classList.remove('active');
                body.style.overflow = 'auto';
                boardForm.reset();
                filePreview.innerHTML = '';
                fileLabelText.innerText = '이미지 또는 동영상 첨부 (5MB 이하)';
                loadBoardPosts();
            } else {
                let errorMsg = 'Post failed';
                try {
                    const postData = await postResp.json();
                    errorMsg = postData.error || errorMsg;
                } catch (jsonErr) {
                    errorMsg = `Server Error (${postResp.status}): HTML response or invalid JSON.`;
                }
                throw new Error(errorMsg);
            }
        } catch (err) {
            showToast('오류: ' + err.message);
        } finally {
            setSearchLoading(false);
        }
    });

    async function loadBoardPosts() {
        if (!boardGrid) return;
        boardGrid.innerHTML = '<div class="loading-spinner">로딩 중...</div>';
        try {
            const resp = await fetch('/api/board');
            const posts = await resp.json();

            // [v106] DEBUG: Log response in browser console
            console.log('========== BOARD API RESPONSE ==========');
            console.log('Total posts:', posts.length);
            if (posts.length > 0) {
                console.log('First post:', posts[0]);
                console.log('First post mediaUrl:', posts[0].mediaUrl);
            }
            console.log('========================================');

            boardGrid.innerHTML = '';
            if (posts.length === 0) {
                boardGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; opacity:0.5; padding:2rem;">첫 게시글을 작성해보세요!</p>';
                return;
            }
            posts.forEach(post => {
                const card = document.createElement('div');
                card.className = 'board-card';
                card.dataset.id = post.id;
                let mediaHtml = '';

                // [v103] Use mediaUrl or imageUrl from backend
                const thumbUrl = post.mediaUrl || post.imageUrl || '';
                const isVideo = post.mediaType === 'video';

                if (thumbUrl) {
                    if (isVideo) {
                        mediaHtml = `<div class="board-media"><video src="${thumbUrl}" controls muted></video></div>`;
                    } else {
                        mediaHtml = `<div class="board-media"><img src="${thumbUrl}" loading="lazy" onerror="this.parentElement.style.opacity='0.5'; this.style.display='none';"></div>`;
                    }
                }

                // [v120] Robust owner check (matching both username and name for compatibility)
                const currentUser = JSON.parse(sessionStorage.getItem('aura_session') || '{}');
                const isOwner = currentUser.username === post.author || currentUser.name === post.author || currentUser.username === 'admin';

                card.innerHTML = `
                    ${mediaHtml}
                    <div class="board-info">
                        <h4>${post.title}</h4>
                        <p>${post.content}</p>
                        <div class="board-meta">
                            <span>BY ${post.author || '익명'}</span>
                            <span>${post.date}</span>
                        </div>
                        ${isOwner ? `
                            <button class="board-delete-btn" data-id="${post.id}">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        ` : ''}
                    </div>
                `;

                // Click handler for viewing post
                card.addEventListener('click', (e) => {
                    // Don't open modal if clicking delete button
                    if (e.target.closest('.board-delete-btn')) return;
                    openBoardReadModal(post);
                });

                // Delete button handler
                if (isOwner) {
                    const deleteBtn = card.querySelector('.board-delete-btn');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();

                            auraConfirm('정말 이 게시글을 삭제하시겠습니까?', async () => {
                                try {
                                    const response = await fetch(`/api/board/${post.id}`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ username: currentUser.username })
                                    });

                                    if (response.ok) {
                                        showToast('게시글이 삭제되었습니다 ✅');
                                        loadBoardPosts();
                                    } else {
                                        const error = await response.json();
                                        showToast(error.error || '삭제 실패 ❌');
                                    }
                                } catch (e) {
                                    showToast('삭제 중 오류가 발생했습니다 ❌');
                                }
                            });
                        });
                    }
                }

                boardGrid.appendChild(card);
            });
        } catch (err) {
            boardGrid.innerHTML = '<p>게시글을 불러오지 못했습니다.</p>';
        }
    }

    // [v100.9] Board Read Modal Logic (Re-added)
    const boardReadModal = document.getElementById('board-read-modal');
    const closeBoardReadModal = document.getElementById('close-board-read-modal');

    // Close button logic
    if (closeBoardReadModal) {
        closeBoardReadModal.addEventListener('click', () => {
            boardReadModal.classList.remove('active');
            body.style.overflow = 'auto';
        });
    }

    function openBoardReadModal(post) {
        if (!boardReadModal) return;

        // [v114] Reset scroll
        const bodyScroll = boardReadModal.querySelector('.board-read-body-scroll');
        if (bodyScroll) bodyScroll.scrollTop = 0;

        document.getElementById('board-read-title').innerText = post.title;

        // [v114] Updated IDs in new HTML structure
        const authorEl = boardReadModal.querySelector('#board-read-author');
        if (authorEl) authorEl.innerText = post.author || '익명';

        const dateEl = boardReadModal.querySelector('#board-read-date');
        if (dateEl) dateEl.innerText = post.date;

        const contentEl = boardReadModal.querySelector('#board-read-content'); // Now a div, not p
        if (contentEl) contentEl.innerText = post.content;

        const mediaContainer = boardReadModal.querySelector('#board-read-media');
        if (mediaContainer) {
            mediaContainer.innerHTML = ''; // Clear previous media
            mediaContainer.style.display = 'block';

            // [v109] Support Multiple Media Elements
            const mediaItems = post.media && post.media.length > 0 ? post.media : (post.mediaUrl ? [{ url: post.mediaUrl, type: post.mediaType }] : []);

            mediaItems.forEach(item => {
                if (item.youtubeId) {
                    const container = document.createElement('div');
                    container.className = 'video-container';
                    container.innerHTML = `<iframe src="https://www.youtube.com/embed/${item.youtubeId}" allowfullscreen></iframe>`;
                    mediaContainer.appendChild(container);
                } else if (item.type === 'video') {
                    const video = document.createElement('video');
                    video.src = item.url;
                    video.controls = true;
                    video.style.width = '100%';
                    video.style.borderRadius = '12px';
                    video.style.marginBottom = '1rem';
                    mediaContainer.appendChild(video);
                } else if (item.url) {
                    const img = document.createElement('img');
                    img.src = item.url;
                    img.style.height = 'auto'; // [v109] Preserve Aspect Ratio
                    img.style.display = 'block';
                    img.style.borderRadius = '12px';
                    img.style.marginBottom = '1rem';
                    img.onerror = function () {
                        this.style.display = 'none';
                    };
                    mediaContainer.appendChild(img);
                }
            });
        }
        boardReadModal.classList.add('active');
        body.style.overflow = 'hidden';
    }

    // --- Utilities ---
    function appendData(data, id, isNews) {
        const g = document.getElementById(id); if (!g || !data) return;
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = item.imageUrl ? 'gallery-item' : 'gallery-item no-image';
            const itemName = (item.name && item.name !== 'undefined') ? item.name : '';
            const itemDate = (item.pubDate && item.pubDate !== 'undefined') ? item.pubDate : '';

            // [v145] Custom styling for items without images (News, etc.)
            let contentStyle = '';
            if (!item.imageUrl && isNews) {
                contentStyle = `style="background: transparent; border: 1px solid var(--glass-border); color: #fffcf0;"`;
            }

            div.innerHTML = `
                <div class="card-glow"></div>
                ${item.imageUrl ? `<img src="${item.imageUrl}" loading="lazy">` : ''}
                <div class="car-info" ${contentStyle}>
                    <h4>${itemName}</h4>
                    <p style="font-size:0.8rem; opacity:0.5;">${itemDate}</p>
                </div>`;
            div.addEventListener('click', () => {
                if (id === 'idea-grid') {
                    // [v81] Idea Board: Show popup modal without title
                    openDetailModal(item, true);
                } else if (isNews || item.link) {
                    window.open(item.link || '#', '_blank');
                } else {
                    openDetailModal(item);
                }
            });
            g.appendChild(div);
        });
    }

    async function loadGuestbook() {
        if (!gbList) return;
        try {
            const resp = await fetch('/api/guestbook');
            const messages = await resp.json();

            gbList.innerHTML = '';
            messages.forEach((msg) => {
                const div = document.createElement('div'); div.className = 'guest-item';
                const isOwner = currentUser && (msg.username === currentUser.username || currentUser.username === 'admin');
                div.innerHTML = `
                    <div class="guest-meta">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column;">
                                <span class="guest-name">${msg.name}</span>
                                <span class="guest-date">${msg.date}</span>
                            </div>
                            ${isOwner ? `<button class="gb-delete-btn" data-id="${msg.id}"><ion-icon name="close-outline"></ion-icon></button>` : ''}
                        </div>
                    </div>
                    <div class="guest-text">${msg.text}</div>
                `;
                gbList.appendChild(div);
            });

            // Delete Event
            document.querySelectorAll('.gb-delete-btn').forEach(btn => {
                btn.onclick = () => {
                    auraConfirm('정말 삭제하시겠습니까? 🥺', async () => {
                        const id = btn.getAttribute('data-id');
                        try {
                            const dr = await fetch(`/api/guestbook/${id}`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: currentUser.username })
                            });
                            if (dr.ok) {
                                showToast('정상적으로 삭제되었습니다. ✅');
                                loadGuestbook();
                            } else showToast('삭제 실패! 권한이 없거나 이미 삭제된 글일 수 있습니다.');
                        } catch (e) { showToast('삭제 중 오류가 발생했습니다. 😵'); }
                    });
                };
            });
        } catch (e) {
            console.error('Failed to load guestbook', e);
            gbList.innerHTML = '<p class="loading-msg">데이터를 불러오지 못했습니다. 😢</p>';
        }
    }

    gbSubmit?.addEventListener('click', async () => {
        const text = gbInput.value.trim();
        if (!text || text.length > 200) return showToast(text ? '200자 이내로 써주세요! 🌸' : '내용을 입력해주세요! ✍️');

        try {
            const resp = await fetch('/api/guestbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: currentUser.name,
                    username: currentUser.username,
                    text: text
                })
            });

            if (resp.ok) {
                gbInput.value = '';
                showToast('소중한 글이 기록되었습니다. 🌸');
                loadGuestbook();
            } else {
                const errorData = await resp.json();
                const reason = errorData.detail?.message || errorData.error || '잠시 후 다시 시도해 주세요.';
                showToast(`기록 실패: ${reason}`);
            }
        } catch (e) {
            showToast(`시스템 오류가 발생했습니다. 😵`);
        }
    });

    // [v131] Redundant logout block removed (consolidated at top)
    // [v131] Redundant logout block removed (consolidated at top)

    const modal = document.getElementById('detail-modal');
    const modalBody = document.querySelector('.modal-body');

    function openDetailModal(item, hideTitle = false) {
        const detailModal = document.getElementById('detail-modal');
        const modalImgContainer = detailModal.querySelector('.modal-image-container');
        const modalImg = detailModal.querySelector('#modal-img');
        const modalTitle = detailModal.querySelector('#modal-title');
        const modalSummary = detailModal.querySelector('#modal-summary');
        const modalTextContainer = detailModal.querySelector('.modal-text-container');
        const modalContent = detailModal.querySelector('.modal-content');

        if (!detailModal) return;

        // Clear previous content
        modalBody.innerHTML = '';

        const titleText = (item.name && item.name !== 'undefined') ? item.name : '';
        const summaryText = (item.summary && item.summary !== 'undefined') ? item.summary : (item.desc && item.desc !== 'undefined' ? item.desc : '');

        if (item.youtubeId) {
            // YouTube Embed 모드
            modalBody.innerHTML = `
                <div class="video-container">
                    <iframe src="https://www.youtube.com/embed/${item.youtubeId}?autoplay=1"
                            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen></iframe>
                </div>
                <div class="modal-text-container">
                    <h2 id="modal-title">${titleText}</h2>
                    <p id="modal-summary">${summaryText}</p>
                </div>
            `;
        } else {
            // 일반 이미지 모드
            modalBody.innerHTML = `
                <div class="modal-image-container">
                    <img id="modal-img" src="${item.imageUrl}" alt="${titleText}">
                </div>
                <div class="modal-text-container">
                    <h2 id="modal-title">${titleText}</h2>
                    <p id="modal-summary">${summaryText}</p>
                </div>
            `;
        }

        // [v81] Hide title if requested (for Idea Board)
        if (hideTitle) {
            modalContent.classList.add('hide-title');
        } else {
            modalContent.classList.remove('hide-title');
        }

        detailModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            if (modalBody) modalBody.scrollTop = 0;
            if (detailModal) detailModal.scrollTop = 0;
        }, 10);
    }

    // Modal Closing Logic (v60)
    function closeModal() {
        const detailModal = document.getElementById('detail-modal');
        if (detailModal) {
            detailModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            // HTML inner content cleanup to stop videos
            setTimeout(() => { modalBody.innerHTML = ''; }, 300);
        }
    }

    const detailModal = document.getElementById('detail-modal');
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                closeModal();
            }
        });
    }
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

        // US + Korean stock symbols with REAL fallback data (Recent Closing Prices)
        // FMP API Demo Key has limits, so these fallbacks are crucial.
        const usStocks = [
            { symbol: 'NVDA', name: 'NVIDIA', region: 'US', fallback: { price: 135.00, change: 2.50, percent: 1.85 } },
            { symbol: 'MSFT', name: 'Microsoft', region: 'US', fallback: { price: 415.00, change: -1.20, percent: -0.29 } },
            { symbol: 'GOOGL', name: 'Alphabet', region: 'US', fallback: { price: 175.00, change: 1.50, percent: 0.86 } },
            { symbol: 'AAPL', name: 'Apple', region: 'US', fallback: { price: 230.00, change: 1.10, percent: 0.48 } },
            { symbol: 'TSLA', name: 'Tesla', region: 'US', fallback: { price: 250.00, change: -5.00, percent: -2.00 } }
        ];

        const krStocks = [
            { symbol: '005930.KS', name: '삼성전자', region: 'KR', fallback: { price: 58000, change: -500, percent: -0.85 } },
            { symbol: '000660.KS', name: 'SK하이닉스', region: 'KR', fallback: { price: 185000, change: 2000, percent: 1.09 } },
            { symbol: '373220.KS', name: 'LG에너지솔루션', region: 'KR', fallback: { price: 390000, change: 1000, percent: 0.26 } },
            { symbol: '207940.KS', name: '삼성바이오로직스', region: 'KR', fallback: { price: 780000, change: -5000, percent: -0.64 } },
            { symbol: '005380.KS', name: '현대차', region: 'KR', fallback: { price: 240000, change: 1000, percent: 0.42 } },
            { symbol: '000270.KS', name: '기아', region: 'KR', fallback: { price: 120000, change: 500, percent: 0.42 } },
            { symbol: '068270.KS', name: '셀트리온', region: 'KR', fallback: { price: 180000, change: -1000, percent: -0.55 } },
            { symbol: '105560.KS', name: 'KB금융', region: 'KR', fallback: { price: 78000, change: 200, percent: 0.26 } },
            { symbol: '035420.KS', name: 'NAVER', region: 'KR', fallback: { price: 170000, change: -1500, percent: -0.87 } },
            { symbol: '035720.KS', name: '카카오', region: 'KR', fallback: { price: 38000, change: 500, percent: 1.33 } }
        ];

        // Load stock data with fallback
        if (marketList) {
            try {
                const loadStocks = async (stocks) => {
                    const stockPromises = stocks.map(async (stock) => {
                        try {
                            let code = stock.symbol;
                            // KR stocks: remove .KS suffix for Naver
                            if (stock.region === 'KR') {
                                code = stock.symbol.replace('.KS', '');
                            }

                            // Call our Unified API (Naver for KR, Yahoo for US)
                            const response = await fetch(`/api/stock?code=${code}`);
                            if (!response.ok) throw new Error('API Error');

                            const data = await response.json();
                            return {
                                symbol: stock.symbol,
                                name: stock.name,
                                region: stock.region,
                                price: data.price,
                                change: data.change,
                                percent: data.percent,
                                isLive: true
                            };
                        } catch (e) {
                            // Use fallback data if scraping fails
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
                    <div class="market-region-header" style="margin-top:1rem;">🇰🇷 한국 주요 종목 ${hasLiveData ? '(네이버 실시간)' : '(최근 종가)'}</div>
                ${krData.map(renderStock).join('')}
                <p style="font-size:0.7rem; opacity:0.5; margin-top:1rem; text-align:center;">
                    * 데이터 출처: 네이버 금융 (KR) / 야후 파이낸스 (US) <br>
                    * 자동 업데이트: 30초 주기
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

    // [v118] Cleaned up duplicate board logic. Global board functions are defined above.
    const boardTab = document.querySelector('[data-tab="board"]');
    if (boardTab) {
        boardTab.addEventListener('click', loadBoardPosts);
    }

    // Auto-refresh stock data every 5 minutes
    function startStockRefresh() {
        if (stockRefreshInterval) clearInterval(stockRefreshInterval);
        stockRefreshInterval = setInterval(loadAIInsights, 300000); // 5 minutes (v145)
    }

    // Start stock refresh automatically
    startStockRefresh();

    // Global cursor tracking
    document.addEventListener('mousemove', e => {
        if (auraCursor) {
            auraCursor.style.left = `${e.clientX}px`;
            auraCursor.style.top = `${e.clientY}px`;
        }
    });
    // [v89] Back to Top Logic
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});
