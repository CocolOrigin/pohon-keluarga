/**
 * SILSILAH KELUARGA (FAMILY TREE) APPLICATION
 * Live Google Sheet API Integration & Centered Subtree Layout Engine
 */

// Google Apps Script API URL
const API_URL = "https://script.google.com/macros/s/AKfycbwDfDtj3rILYjmUzawlpN2gK9eFxel0WChuNGxgRhoGJwMVhHA4cwAXXN0tFviKAXk/exec";

// App State
let familyData = [];
let isEditMode = false;
let currentZoom = 1.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX = 0, startY = 0;
let isDataLoading = false;

const collapsedUnions = new Set();
let strokeWidth = 2, outlineWidth = 3, outlineGap = 3;
let initialPinchDistance = null, initialZoomOnPinch = 1.0;

// DOM Elements
const canvasContainer = document.getElementById('canvasContainer');
const treeViewport = document.getElementById('treeViewport');
const treeNodes = document.getElementById('treeNodes');
const svgLayer = document.getElementById('svgLayer');
const canvasActionsLayer = document.getElementById('canvasActionsLayer');
const loadingOverlay = document.getElementById('loadingOverlay');
const modeEditToggle = document.getElementById('modeEditToggle');
const btnAddNewPerson = document.getElementById('btnAddNewPerson');

const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const zoomRange = document.getElementById('zoomRange');
const btnResetView = document.getElementById('btnResetView');
const zoomPercent = document.getElementById('zoomPercent');

const styleMenuPopover = document.getElementById('styleMenuPopover');
const strokeWidthSlider = document.getElementById('strokeWidthSlider');
const outlineWidthSlider = document.getElementById('outlineWidthSlider');
const outlineGapSlider = document.getElementById('outlineGapSlider');

const detailModal = document.getElementById('detailModal');
const detailCardContent = document.getElementById('detailCardContent');
const formModal = document.getElementById('formModal');
const personForm = document.getElementById('personForm');

const formId = document.getElementById('formId');
const formNama = document.getElementById('formNama');
const formPanggilan = document.getElementById('formPanggilan');
const formJk = document.getElementById('formJk');
const formAyah = document.getElementById('formAyah');
const formIbu = document.getElementById('formIbu');
const formPasangan = document.getElementById('formPasangan');
const formUrutan = document.getElementById('formUrutan');
const formTglLahir = document.getElementById('formTglLahir');
const formTglWafat = document.getElementById('formTglWafat');
const formFoto = document.getElementById('formFoto');
const formCatatan = document.getElementById('formCatatan');
const btnGenderL = document.getElementById('btnGenderL');
const btnGenderP = document.getElementById('btnGenderP');

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadFamilyDataFromGoogleSheet();
    centerCanvas();
});

/* ==========================================================================
   1. REAL DATA FETCHING FROM GOOGLE SHEET (WITH CACHE BUSTER)
   ========================================================================== */

function loadFamilyDataFromGoogleSheet() {
    if (isDataLoading) return;
    isDataLoading = true;
    showLoading(true);

    const oldScript = document.getElementById('jsonpScript');
    if (oldScript) oldScript.remove();

    const callbackName = 'onGoogleSheetDataLoaded';
    const script = document.createElement('script');
    script.id = 'jsonpScript';
    
    window[callbackName] = function(response) {
        isDataLoading = false;
        showLoading(false);

        if (Array.isArray(response) && response.length > 0) {
            familyData = sanitizeData(response);
            showToast("Data Google Sheet berhasil dimuat!");
        } else {
            showToast("Data Google Sheet kosong.");
            familyData = [];
        }
        renderTree();
    };

    script.src = `${API_URL}?action=get&callback=${callbackName}&_t=${Date.now()}`;
    script.onerror = () => {
        isDataLoading = false;
        showLoading(false);
        showToast("Gagal memuat data dari Google Sheet.");
    };
    document.body.appendChild(script);
}

function sanitizeData(data) {
    const cleanList = data.map(item => ({
        id: String(item.id || ''),
        nama: String(item.nama || ''),
        panggilan: String(item.panggilan || ''),
        jk: String(item.jk || 'L').toUpperCase(),
        ayah_id: String(item.ayah_id || ''),
        ibu_id: String(item.ibu_id || ''),
        pasangan_id: String(item.pasangan_id || ''),
        urutan_anak: item.urutan_anak ? parseInt(item.urutan_anak) : '',
        tgl_lahir: String(item.tgl_lahir || ''),
        tgl_wafat: String(item.tgl_wafat || ''),
        foto: String(item.foto || ''),
        catatan: String(item.catatan || '')
    }));

    // Auto Bi-directional Link Pasangan
    const personMap = new Map();
    cleanList.forEach(p => personMap.set(p.id, p));

    cleanList.forEach(p => {
        if (p.pasangan_id && personMap.has(p.pasangan_id)) {
            const spouse = personMap.get(p.pasangan_id);
            if (!spouse.pasangan_id) spouse.pasangan_id = p.id;
        }
    });

    return cleanList;
}

/* ==========================================================================
   2. RENDERING ENGINE & CANVAS POSITIONING (U-BRACKET & CENTERED SINGLE CHILD)
   ========================================================================== */

function renderTree() {
    treeNodes.innerHTML = '';
    svgLayer.innerHTML = '';
    canvasActionsLayer.innerHTML = '';

    if (familyData.length === 0) return;

    document.documentElement.style.setProperty('--photo-outline-width', `${outlineWidth}px`);
    document.documentElement.style.setProperty('--photo-outline-gap', `${outlineGap}px`);

    const treeModel = buildTreeHierarchy();
    const layout = computeTreeLayout(treeModel);

    drawSVGConnections(layout.connections);
    layout.nodes.forEach(node => renderNodeCard(node));

    if (isEditMode) {
        renderCanvasActionButtons(layout.actionButtons);
    }

    updateEditModeUI();
}

function buildTreeHierarchy() {
    const personMap = new Map();
    familyData.forEach(p => personMap.set(p.id, p));

    const roots = familyData.filter(p => !p.ayah_id && !p.ibu_id);
    const rootUnions = [];
    const processedPersonIds = new Set();

    roots.forEach(person => {
        if (processedPersonIds.has(person.id)) return;
        const spouse = person.pasangan_id ? personMap.get(person.pasangan_id) : null;
        processedPersonIds.add(person.id);
        if (spouse) processedPersonIds.add(spouse.id);

        rootUnions.push(buildUnionNode(person, spouse, personMap, processedPersonIds));
    });

    return rootUnions;
}

function buildUnionNode(primary, spouse, personMap, processedSet) {
    const unionId = spouse ? `U_${primary.id}_${spouse.id}` : `U_${primary.id}`;
    
    const children = familyData.filter(p => {
        if (primary && spouse) {
            return (p.ayah_id === primary.id || p.ibu_id === primary.id) &&
                   (p.ayah_id === spouse.id || p.ibu_id === spouse.id);
        } else if (primary) {
            return p.ayah_id === primary.id || p.ibu_id === primary.id;
        }
        return false;
    });

    children.sort((a, b) => (a.urutan_anak || 99) - (b.urutan_anak || 99));

    const childUnions = [];
    children.forEach(child => {
        const childSpouse = child.pasangan_id ? personMap.get(child.pasangan_id) : null;
        processedSet.add(child.id);
        if (childSpouse) processedSet.add(childSpouse.id);

        childUnions.push(buildUnionNode(child, childSpouse, personMap, processedSet));
    });

    return { unionId, primary, spouse, children: childUnions, isCollapsed: collapsedUnions.has(unionId) };
}

function computeTreeLayout(rootUnions) {
    const CARD_WIDTH = 170;
    const CARD_HEIGHT = 160;
    const H_GAP = 50;
    const V_GAP = 120;

    const nodes = [];
    const connections = [];
    const actionButtons = [];

    let currentX = 100;
    const startY = 100;

    // Helper untuk menghitung total lebar sub-pohon sebelum penataan
    function getSubtreeWidth(union) {
        const hasSpouse = !!union.spouse;
        const unionWidth = hasSpouse ? (CARD_WIDTH * 2 + 20) : CARD_WIDTH;

        if (union.children.length === 0 || union.isCollapsed) {
            return unionWidth;
        }

        let childrenWidth = 0;
        union.children.forEach((childUnion, idx) => {
            childrenWidth += getSubtreeWidth(childUnion) + (idx < union.children.length - 1 ? H_GAP : 0);
        });

        return Math.max(unionWidth, childrenWidth);
    }

    function layoutSubtree(union, x, y) {
        const hasSpouse = !!union.spouse;
        const unionWidth = hasSpouse ? (CARD_WIDTH * 2 + 20) : CARD_WIDTH;

        let childrenTotalWidth = 0;
        const isCollapsed = union.isCollapsed;

        if (union.children.length > 0 && !isCollapsed) {
            let tempX = 0;
            union.children.forEach((childUnion, idx) => {
                tempX += getSubtreeWidth(childUnion) + (idx < union.children.length - 1 ? H_GAP : 0);
            });
            childrenTotalWidth = tempX;
        }

        const subtreeWidth = Math.max(unionWidth, childrenTotalWidth);

        // PENATAAN PRESISI:
        // Jika blok anak lebih kecil dari pasangan orang tua (misal Anak Tunggal), anak ditaruh tepat di tengah!
        let primaryX = x;
        let childXStart = x;

        if (childrenTotalWidth > unionWidth) {
            primaryX = x + (childrenTotalWidth - unionWidth) / 2;
        } else if (unionWidth > childrenTotalWidth && childrenTotalWidth > 0) {
            childXStart = x + (unionWidth - childrenTotalWidth) / 2;
        }

        const primaryY = y;

        nodes.push({
            person: union.primary,
            x: primaryX,
            y: primaryY,
            unionId: union.unionId,
            hasChildren: union.children.length > 0,
            isCollapsed: isCollapsed
        });

        let parentCenterX = primaryX + CARD_WIDTH / 2;
        let parentBridgeY = primaryY + CARD_HEIGHT;

        if (!hasSpouse) {
            // Tombol Tambah Pasangan di Samping Card
            actionButtons.push({
                type: 'add-spouse',
                personId: union.primary.id,
                x: primaryX + CARD_WIDTH + 8,
                y: primaryY + 45
            });
        } else {
            const spouseX = primaryX + CARD_WIDTH + 20;
            nodes.push({
                person: union.spouse,
                x: spouseX,
                y: primaryY,
                unionId: union.unionId,
                hasChildren: false,
                isCollapsed: false
            });

            // GARIS PASANGAN MODEL U-BRACKET (SESUAI CORETAN MERAH)
            const bracketDepth = 20;
            const husbandX = primaryX + CARD_WIDTH / 2;
            const wifeX = spouseX + CARD_WIDTH / 2;
            const bottomY = primaryY + CARD_HEIGHT;
            const bracketY = bottomY + bracketDepth;

            // Turun dari bawah Suami -> Garis Horizontal -> Naik ke bawah Istri
            connections.push({ type: 'spouse-bracket', x1: husbandX, y1: bottomY, x2: husbandX, y2: bracketY });
            connections.push({ type: 'spouse-bracket', x1: husbandX, y1: bracketY, x2: wifeX, y2: bracketY });
            connections.push({ type: 'spouse-bracket', x1: wifeX, y1: bracketY, x2: wifeX, y2: bottomY });

            parentCenterX = (husbandX + wifeX) / 2; // Tepat di tengah-tengah U-bracket
            parentBridgeY = bracketY;

            // Tombol + Anak di Tengah U-Bracket
            actionButtons.push({
                type: 'add-child',
                parentId: union.primary.id,
                x: parentCenterX - 32,
                y: parentBridgeY + 8
            });
        }

        // Penataan Anak-Anak
        if (union.children.length > 0 && !isCollapsed) {
            let currentChildX = childXStart;
            union.children.forEach(childUnion => {
                const childRes = layoutSubtree(childUnion, currentChildX, y + CARD_HEIGHT + V_GAP);
                currentChildX += childRes.subtreeWidth + H_GAP;
            });

            const midY = parentBridgeY + (V_GAP - (hasSpouse ? 20 : 0)) / 2;

            // Garis vertikal turun dari titik tengah jembatan orang tua
            connections.push({ type: 'stem', x1: parentCenterX, y1: parentBridgeY, x2: parentCenterX, y2: midY });

            // Titik tengah setiap anak
            const childCenters = union.children.map(c => {
                const cNode = nodes.find(n => n.person.id === c.primary.id);
                return cNode.x + (CARD_WIDTH / 2);
            });

            const minChildX = Math.min(...childCenters);
            const maxChildX = Math.max(...childCenters);

            // Garis horizontal pembagi cabang (hanya jika anak > 1)
            if (childCenters.length > 1) {
                connections.push({ type: 'branch', x1: minChildX, y1: midY, x2: maxChildX, y2: midY });
            }

            // Garis vertikal masuk ke atas kartu anak
            childCenters.forEach(cX => {
                connections.push({ type: 'child', x1: cX, y1: midY, x2: cX, y2: primaryY + CARD_HEIGHT + V_GAP });
            });
        }

        return { subtreeWidth };
    }

    rootUnions.forEach(rootUnion => {
        const result = layoutSubtree(rootUnion, currentX, startY);
        currentX += result.subtreeWidth + H_GAP * 2;
    });

    return { nodes, connections, actionButtons };
}

function drawSVGConnections(connections) {
    connections.forEach(conn => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", conn.x1);
        line.setAttribute("y1", conn.y1);
        line.setAttribute("x2", conn.x2);
        line.setAttribute("y2", conn.y2);
        line.setAttribute("stroke", "var(--tree-stroke-color)");
        line.setAttribute("stroke-width", strokeWidth);
        svgLayer.appendChild(line);
    });
}

function renderNodeCard(node) {
    const person = node.person;
    const isMale = person.jk === 'L';
    const isDeceased = !!person.tgl_wafat;

    const card = document.createElement('div');
    card.className = `node-card ${isMale ? 'male' : 'female'} ${isDeceased ? 'deceased' : ''}`;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;

    const defaultAvatar = isMale ? 'assets/man.png' : 'assets/woman.png';
    const avatarSrc = person.foto && person.foto.trim() !== '' ? person.foto : defaultAvatar;

    // Nama Panggilan (Atas, Tebal) & Nama Lengkap (Bawah)
    const primaryName = person.panggilan && person.panggilan.trim() !== '' ? person.panggilan.trim() : person.nama;
    const secondaryName = person.panggilan && person.panggilan.trim() !== '' ? person.nama : '';

    card.innerHTML = `
        <div class="avatar-wrapper">
            <img class="avatar-img" src="${avatarSrc}" alt="${person.nama}" onerror="this.src='${defaultAvatar}'">
            ${isDeceased ? '<div class="deceased-ribbon"><i class="fa-solid fa-ribbon"></i></div>' : ''}
        </div>
        <div class="node-primary-name">${escapeHtml(primaryName)}</div>
        ${secondaryName ? `<div class="node-secondary-name">${escapeHtml(secondaryName)}</div>` : ''}
        <div class="node-badge">${isDeceased ? 'Almarhum' + (isMale ? '' : 'ah') : (isMale ? 'Laki-Laki' : 'Perempuan')}</div>

        ${node.hasChildren ? `
            <button class="btn-toggle-subtree" data-union="${node.unionId}">
                <i class="fa-solid ${node.isCollapsed ? 'fa-plus' : 'fa-minus'}"></i>
            </button>
        ` : ''}
    `;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-toggle-subtree')) return;
        openDetailModal(person.id);
    });

    const btnToggle = card.querySelector('.btn-toggle-subtree');
    if (btnToggle) {
        btnToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const uId = btnToggle.getAttribute('data-union');
            collapsedUnions.has(uId) ? collapsedUnions.delete(uId) : collapsedUnions.add(uId);
            renderTree();
        });
    }

    treeNodes.appendChild(card);
}

function renderCanvasActionButtons(buttons) {
    buttons.forEach(btn => {
        const btnEl = document.createElement('button');
        
        if (btn.type === 'add-spouse') {
            btnEl.className = 'canvas-btn-action btn-canvas-spouse';
            btnEl.style.left = `${btn.x}px`;
            btnEl.style.top = `${btn.y}px`;
            btnEl.innerHTML = `<i class="fa-solid fa-heart"></i> + Pasangan`;
            btnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openFormModalToAddSpouse(btn.personId);
            });
        } else if (btn.type === 'add-child') {
            btnEl.className = 'canvas-btn-action btn-canvas-child';
            btnEl.style.left = `${btn.x}px`;
            btnEl.style.top = `${btn.y}px`;
            btnEl.innerHTML = `<i class="fa-solid fa-plus"></i> + Anak`;
            btnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openFormModalToAddChild(btn.parentId);
            });
        }

        canvasActionsLayer.appendChild(btnEl);
    });
}

/* ==========================================================================
   3. UNIFIED PAN, ZOOM, AND TOUCH GESTURES
   ========================================================================== */

function initEventListeners() {
    modeEditToggle.addEventListener('change', (e) => {
        isEditMode = e.target.checked;
        renderTree();
    });

    btnAddNewPerson.addEventListener('click', () => openFormModal());

    canvasContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-card') || e.target.closest('.canvas-btn-action') || e.target.closest('.floating-controls') || e.target.closest('.popover-menu')) return;
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => isDragging = false);

    canvasContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            if (e.target.closest('.node-card') || e.target.closest('.canvas-btn-action') || e.target.closest('.floating-controls')) return;
            isDragging = true;
            startX = e.touches[0].clientX - panX;
            startY = e.touches[0].clientY - panY;
        } else if (e.touches.length === 2) {
            isDragging = false;
            initialPinchDistance = getTouchDistance(e.touches);
            initialZoomOnPinch = currentZoom;
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
            panX = e.touches[0].clientX - startX;
            panY = e.touches[0].clientY - startY;
            applyTransform();
        } else if (e.touches.length === 2 && initialPinchDistance) {
            const dist = getTouchDistance(e.touches);
            setZoom(initialZoomOnPinch * (dist / initialPinchDistance));
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchend', () => { isDragging = false; initialPinchDistance = null; });

    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        setZoom(currentZoom + (e.deltaY < 0 ? 0.08 : -0.08));
    }, { passive: false });

    btnZoomIn.addEventListener('click', () => setZoom(currentZoom + 0.15));
    btnZoomOut.addEventListener('click', () => setZoom(currentZoom - 0.15));
    zoomRange.addEventListener('input', (e) => setZoom(parseFloat(e.target.value)));
    btnResetView.addEventListener('click', centerCanvas);

    document.getElementById('btnToggleStyleMenu').addEventListener('click', () => styleMenuPopover.classList.toggle('hidden'));
    document.getElementById('btnCloseStyleMenu').addEventListener('click', () => styleMenuPopover.classList.add('hidden'));

    strokeWidthSlider.addEventListener('input', (e) => { strokeWidth = e.target.value; document.getElementById('valStrokeWidth').textContent = strokeWidth; renderTree(); });
    outlineWidthSlider.addEventListener('input', (e) => { outlineWidth = e.target.value; document.getElementById('valOutlineWidth').textContent = outlineWidth; renderTree(); });
    outlineGapSlider.addEventListener('input', (e) => { outlineGap = e.target.value; document.getElementById('valOutlineGap').textContent = outlineGap; renderTree(); });

    document.getElementById('btnCloseFormModal').addEventListener('click', closeFormModal);
    document.getElementById('btnCancelForm').addEventListener('click', closeFormModal);

    btnGenderL.addEventListener('click', () => setFormGender('L'));
    btnGenderP.addEventListener('click', () => setFormGender('P'));

    personForm.addEventListener('submit', handleFormSubmit);
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function setZoom(val) {
    currentZoom = Math.min(Math.max(0.3, val), 2.0);
    zoomRange.value = currentZoom;
    zoomPercent.textContent = `${Math.round(currentZoom * 100)}%`;
    applyTransform();
}

function applyTransform() {
    treeViewport.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
}

function centerCanvas() {
    currentZoom = 1.0;
    panX = (window.innerWidth / 2) - 300;
    panY = 100;
    setZoom(1.0);
}

function updateEditModeUI() {
    document.querySelectorAll('.edit-only').forEach(el => {
        el.style.display = isEditMode ? 'inline-flex' : 'none';
    });
}

/* ==========================================================================
   4. DETAIL MODAL & CRUD ACTIONS
   ========================================================================== */

function openDetailModal(personId) {
    const person = familyData.find(p => p.id === personId);
    if (!person) return;

    const isMale = person.jk === 'L';
    const isDeceased = !!person.tgl_wafat;
    const defaultAvatar = isMale ? 'assets/man.png' : 'assets/woman.png';
    const avatarSrc = person.foto && person.foto.trim() !== '' ? person.foto : defaultAvatar;

    const ayah = familyData.find(p => p.id === person.ayah_id);
    const ibu = familyData.find(p => p.id === person.ibu_id);
    const pasangan = familyData.find(p => p.id === person.pasangan_id);
    const children = familyData.filter(p => p.ayah_id === person.id || p.ibu_id === person.id);

    detailCardContent.innerHTML = `
        <div class="${isDeceased ? 'detail-header-memorial' : 'detail-header-normal'}">
            <button class="btn-close-modal" onclick="closeDetailModal()" style="position:absolute; top:16px; right:16px; color:${isDeceased ? '#fef3c7' : '#64748b'};"><i class="fa-solid fa-xmark"></i></button>
            ${isDeceased ? '<div class="memorial-badge"><i class="fa-solid fa-ribbon"></i> Mengenang Almarhum' + (isMale ? '' : 'ah') + '</div>' : ''}
            <div class="detail-avatar-container">
                <img class="detail-avatar" src="${avatarSrc}" alt="${person.nama}">
            </div>
            <h2 class="detail-name">${escapeHtml(person.panggilan || person.nama)}</h2>
            ${person.panggilan ? `<p style="font-size:14px; opacity:0.8;">(${escapeHtml(person.nama)})</p>` : ''}
            <p class="detail-lifespan">${formatDate(person.tgl_lahir)} — ${isDeceased ? formatDate(person.tgl_wafat) : 'Sekarang'}</p>
        </div>

        <div class="detail-body">
            <div class="detail-info-grid">
                <div class="info-item"><span class="label">Jenis Kelamin</span><span class="value">${isMale ? 'Laki-Laki' : 'Perempuan'}</span></div>
                <div class="info-item"><span class="label">Urutan Anak</span><span class="value">${person.urutan_anak ? 'Ke-' + person.urutan_anak : '-'}</span></div>
                <div class="info-item"><span class="label">Ayah</span><span class="value">${ayah ? escapeHtml(ayah.panggilan || ayah.nama) : '-'}</span></div>
                <div class="info-item"><span class="label">Ibu</span><span class="value">${ibu ? escapeHtml(ibu.panggilan || ibu.nama) : '-'}</span></div>
                <div class="info-item" style="grid-column: span 2;"><span class="label">Pasangan</span><span class="value">${pasangan ? escapeHtml(pasangan.panggilan || pasangan.nama) : '-'}</span></div>
            </div>

            ${children.length > 0 ? `<div class="info-item"><span class="label">Daftar Anak (${children.length})</span><span class="value" style="font-size:12px; font-weight:normal;">${children.map(c => escapeHtml(c.panggilan || c.nama)).join(', ')}</span></div>` : ''}
            ${person.catatan ? `<div style="background:#f8fafc; border-left:3px solid #cbd5e1; padding:10px; font-size:13px; line-height:1.5;"><strong>Catatan:</strong><br>${escapeHtml(person.catatan)}</div>` : ''}

            <div class="modal-footer">
                ${isEditMode ? `
                    <button class="btn btn-danger" onclick="deletePersonAction('${person.id}')"><i class="fa-solid fa-trash"></i> Hapus</button>
                    <button class="btn btn-secondary" onclick="openFormModalToEdit('${person.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                ` : ''}
                <button class="btn btn-primary" onclick="closeDetailModal()">Tutup</button>
            </div>
        </div>
    `;

    detailModal.classList.remove('hidden');
}

function closeDetailModal() { detailModal.classList.add('hidden'); }

function populateDropdowns(currentId = null) {
    const males = familyData.filter(p => p.jk === 'L' && p.id !== currentId);
    const females = familyData.filter(p => p.jk === 'P' && p.id !== currentId);
    const all = familyData.filter(p => p.id !== currentId);

    formAyah.innerHTML = '<option value="">-- Tanpa Ayah (Leluhur) --</option>' + males.map(p => `<option value="${p.id}">${escapeHtml(p.panggilan ? p.panggilan + ' (' + p.nama + ')' : p.nama)}</option>`).join('');
    formIbu.innerHTML = '<option value="">-- Tanpa Ibu (Leluhur) --</option>' + females.map(p => `<option value="${p.id}">${escapeHtml(p.panggilan ? p.panggilan + ' (' + p.nama + ')' : p.nama)}</option>`).join('');
    formPasangan.innerHTML = '<option value="">-- Tidak Ada Pasangan --</option>' + all.map(p => `<option value="${p.id}">${escapeHtml(p.panggilan ? p.panggilan + ' (' + p.nama + ')' : p.nama)}</option>`).join('');
}

function setFormGender(jk) {
    formJk.value = jk;
    if (jk === 'L') {
        btnGenderL.classList.add('active-male'); btnGenderP.classList.remove('active-female');
    } else {
        btnGenderL.classList.remove('active-male'); btnGenderP.classList.add('active-female');
    }
}

function openFormModal(editData = null) {
    personForm.reset();
    populateDropdowns(editData ? editData.id : null);

    if (editData) {
        document.getElementById('formModalTitle').innerHTML = '<i class="fa-solid fa-user-pen"></i> Edit Anggota Keluarga';
        formId.value = editData.id; formNama.value = editData.nama; formPanggilan.value = editData.panggilan;
        setFormGender(editData.jk); formAyah.value = editData.ayah_id; formIbu.value = editData.ibu_id;
        formPasangan.value = editData.pasangan_id; formUrutan.value = editData.urutan_anak;
        formTglLahir.value = editData.tgl_lahir; formTglWafat.value = editData.tgl_wafat;
        formFoto.value = editData.foto; formCatatan.value = editData.catatan;
    } else {
        document.getElementById('formModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> Tambah Anggota Keluarga';
        formId.value = ''; setFormGender('L');
    }
    formModal.classList.remove('hidden');
}

function openFormModalToAddChild(parentId) {
    const parent = familyData.find(p => p.id === parentId);
    openFormModal();
    if (parent) {
        if (parent.jk === 'L') {
            formAyah.value = parent.id;
            if (parent.pasangan_id) formIbu.value = parent.pasangan_id;
        } else {
            formIbu.value = parent.id;
            if (parent.pasangan_id) formAyah.value = parent.pasangan_id;
        }
        const existing = familyData.filter(p => p.ayah_id === formAyah.value || p.ibu_id === formIbu.value);
        formUrutan.value = existing.length + 1;
    }
}

function openFormModalToAddSpouse(personId) {
    const person = familyData.find(p => p.id === personId);
    openFormModal();
    if (person) {
        formPasangan.value = person.id;
        setFormGender(person.jk === 'L' ? 'P' : 'L');
    }
}

function openFormModalToEdit(personId) {
    closeDetailModal();
    const person = familyData.find(p => p.id === personId);
    if (person) openFormModal(person);
}

function closeFormModal() { formModal.classList.add('hidden'); }

function handleFormSubmit(e) {
    e.preventDefault();
    const isEdit = !!formId.value;
    const newId = isEdit ? formId.value : `P${String(getNextIdNumber()).padStart(4, '0')}`;

    const personObj = {
        id: newId, nama: formNama.value.trim(), panggilan: formPanggilan.value.trim(), jk: formJk.value,
        ayah_id: formAyah.value, ibu_id: formIbu.value, pasangan_id: formPasangan.value,
        urutan_anak: formUrutan.value, tgl_lahir: formTglLahir.value, tgl_wafat: formTglWafat.value,
        foto: formFoto.value.trim(), catatan: formCatatan.value.trim()
    };

    showToast("Menyimpan ke Google Sheet...");

    sendApiPost(isEdit ? 'update' : 'add', personObj, () => {
        if (personObj.pasangan_id) {
            const spouseObj = familyData.find(p => p.id === personObj.pasangan_id);
            if (spouseObj && spouseObj.pasangan_id !== personObj.id) {
                spouseObj.pasangan_id = personObj.id;
                sendApiPost('update', spouseObj, () => {
                    setTimeout(loadFamilyDataFromGoogleSheet, 1200);
                });
                return;
            }
        }
        setTimeout(loadFamilyDataFromGoogleSheet, 1200);
    });

    closeFormModal();
}

function deletePersonAction(personId) {
    if (!confirm("Apakah Anda yakin ingin menghapus anggota keluarga ini?")) return;
    
    showToast("Menghapus dari Google Sheet...");
    sendApiPost('delete', { id: personId }, () => {
        showToast("Anggota berhasil dihapus!");
        setTimeout(loadFamilyDataFromGoogleSheet, 1200);
    });
    closeDetailModal();
}

function sendApiPost(action, data, callback) {
    fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(() => { if (callback) callback(); })
    .catch(err => {
        console.error("API Post Error:", err);
        if (callback) callback();
    });
}

function getNextIdNumber() {
    let max = 0;
    familyData.forEach(p => {
        const n = parseInt(p.id.replace(/\D/g, ''));
        if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = msg; toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
    return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';
}