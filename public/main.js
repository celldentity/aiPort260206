document.addEventListener('DOMContentLoaded', () => {
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

    // 로딩 상태 관리
    let loadingStatus = { cars: false, recipes: false, news: false };
    let cursors = { newsStart: 1 };
    let hasMoreNews = true;
    let isFetchingNews = false;

    // --- Canvas Particles ---
    let particles = [];
    function initCanvas() { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; createParticles(); } }
    class Particle {
        constructor() {
            this.x = Math.random() * (canvas?.width || 0); this.y = Math.random() * (canvas?.height || 0);
            this.vx = (Math.random() - 0.5) * 0.15; this.vy = (Math.random() - 0.5) * 0.15;
            this.radius = Math.random() * 2.5 + 2;
        }
        update() { this.x += this.vx; this.y += this.vy; if (this.x < 0 || this.x > canvas.width) this.vx *= -1; if (this.y < 0 || this.y > canvas.height) this.vy *= -1; }
        draw() { if (ctx) { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.fill(); } }
    }
    function createParticles() { particles = []; for (let i = 0; i < 100; i++) particles.push(new Particle()); }
    function animate() { if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach((p, index) => { p.update(); p.draw(); for (let j = index + 1; j < particles.length; j++) { const p2 = particles[j]; const dx = p.x - p2.x; const dy = p.y - p2.y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist < 180) { ctx.beginPath(); ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * (1 - dist / 180)})`; ctx.lineWidth = 1.0; ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); } } }); requestAnimationFrame(animate); } }
    initCanvas(); animate(); window.addEventListener('resize', initCanvas);

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

            // 데이터 로딩 전략 (v48 + v53 Preview)
            backgroundFullLoad('cars');
            backgroundFullLoad('recipes');
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
        const cardId = type === 'cars' ? 'card-car' : type === 'recipes' ? 'card-recipe' : 'card-news';
        const card = document.getElementById(cardId);
        if (!card) return;

        const data = type === 'cars' ? allCars : type === 'recipes' ? allRecipes : allNews;
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
            if (!loadingStatus.cars && !loadingStatus.recipes) {
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
        const gridId = type === 'cars' ? 'gallery-grid' : 'recipe-grid';

        while (hasMore) {
            try {
                const resp = await fetch(`/api/${type}?size=50${cursor ? `&cursor=${cursor}` : ''}`);
                const data = await resp.json();

                if (type === 'cars') allCars.push(...data.items);
                else allRecipes.push(...data.items);

                if (activeTab === (type === 'cars' ? 'gallery' : 'recipe')) {
                    appendData(data.items, gridId, false);
                }

                // 첫 배치 로드 후 미리보기 업데이트
                if (isFirstBatch) { updateDashboardPreview(type); isFirstBatch = false; }

                hasMore = data.hasMore;
                cursor = data.nextCursor;
            } catch (e) { hasMore = false; }
        }
        loadingStatus[type] = false;
        setSearchLoading(false);
    }

    async function fetchNextNews() {
        if (isFetchingNews || !hasMoreNews) return;
        isFetchingNews = true;
        try {
            const resp = await fetch(`/api/news?start=${cursors.newsStart}`);
            const data = await resp.json();
            allNews.push(...data.items);
            appendData(data.items, 'news-grid', true);
            cursors.newsStart = data.nextStart;
            hasMoreNews = data.hasMore;
            updateDashboardPreview('news'); // 뉴스 미리보기 업데이트
        } catch (e) { hasMoreNews = false; }
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

        renderSearchSubGrid('search-grid-cars', 'search-section-cars', filteredCars, false);
        renderSearchSubGrid('search-grid-recipes', 'search-section-recipes', filteredRecipes, false);
        renderSearchSubGrid('search-grid-news', 'search-section-news', filteredNews, true);

        const total = filteredCars.length + filteredRecipes.length + filteredNews.length;
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
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const gridId = tabId === 'gallery' ? 'gallery-grid' : tabId === 'recipe' ? 'recipe-grid' : tabId === 'news' ? 'news-grid' : null;
        if (gridId) {
            const grid = document.getElementById(gridId);
            if (grid && grid.children.length === 0) {
                const data = tabId === 'gallery' ? allCars : tabId === 'recipe' ? allRecipes : allNews;
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
        messages.reverse().forEach(msg => {
            const div = document.createElement('div'); div.className = 'guest-item';
            div.innerHTML = `<div class="guest-meta"><span class="guest-name">${msg.name}</span><span class="guest-date">${msg.date}</span></div><div class="guest-text">${msg.text}</div>`;
            gbList.appendChild(div);
        });
    }

    gbSubmit?.addEventListener('click', () => {
        const text = gbInput.value.trim(); if (!text || text.length > 200) return alert(text ? '200자 이내로 써주세요! 🌸' : '내용을 입력해주세요! ✍️');
        const messages = JSON.parse(localStorage.getItem('aura_guestbook') || '[]');
        messages.push({ name: currentUser.name, text, date: new Date().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
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
        if (d.imageUrl) {
            document.getElementById('modal-img').src = d.imageUrl;
            document.getElementById('modal-title').innerText = d.name;
            document.getElementById('modal-summary').innerText = d.summary;

            modal.classList.add('active');
            body.style.overflow = 'hidden';

            // 팝업이 활성화된 후 확실하게 최상단으로 스크롤 (setTimeout으로 렌더링 이후 처리)
            setTimeout(() => {
                if (modalBody) modalBody.scrollTop = 0;
                if (modal) modal.scrollTop = 0;
            }, 10);
        }
    }

    // 팝업 바깥(백그라운드) 클릭 시 닫기
    [modal, searchModal].forEach(m => {
        m?.addEventListener('click', (e) => {
            if (e.target === m) {
                m.classList.remove('active');
                body.style.overflow = 'auto';
            }
        });
    });
    document.addEventListener('mousemove', e => {
        if (auraCursor) { auraCursor.style.left = `${e.clientX}px`; auraCursor.style.top = `${e.clientY}px`; }
        document.querySelectorAll('.gallery-item').forEach(c => {
            const r = c.getBoundingClientRect();
            c.style.setProperty('--mouseX', `${e.clientX - r.left}px`);
            c.style.setProperty('--mouseY', `${e.clientY - r.top}px`);
        });
    });
});
