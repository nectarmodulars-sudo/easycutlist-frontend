/* asm-media.js — per-item YouTube video popup and the reference-image
   viewer (prev / next / Esc) for the Size Builder. Load BEFORE app-asm.js.

   Split out of app-asm.js.

       const M = ASMMedia.create({ getVideoLabel, getSbs, getSchemas, escapeHtml });
 */

(function () {
  'use strict';

  function create(ctx) {
    // === Per-item Video button (YouTube embed popup) ========================
    function ytVideoId(url) {
      if (!url) return '';
      const s = String(url).trim();
      const m = s.match(/(?:youtube\.com\/(?:watch\?[^#]*\bv=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
      if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;   // bare 11-char id
      return '';   // channel / playlist / anything not embeddable -> no button
    }
    function buildVideoBtn(schema) {
      const id = schema ? ytVideoId(schema.video) : '';
      if (!id) return '';
      return '<div class="asm-video-cta"><button class="asm-video-btn" onclick="ASMModule.openVideo(\'' + id + '\')"><span class="asm-video-play">&#9658;</span>' + ctx.escapeHtml(ctx.getVideoLabel()) + '</button></div>';
    }
    function openVideo(id) {
      if (!id) return;
      const old = document.getElementById('asm-video-modal'); if (old) old.remove();
      const m = document.createElement('div');
      m.id = 'asm-video-modal';
      m.className = 'asm-video-overlay';
      m.onclick = e => { if (e.target === m) closeVideo(); };
      m.innerHTML =
        '<div class="asm-video-box">' +
          '<button class="asm-video-close" onclick="ASMModule.closeVideo()" title="Close">&#10005;</button>' +
          '<div class="asm-video-frame">' +
            '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1" title="Video" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
          '</div>' +
        '</div>';
      document.body.appendChild(m);
      document.body.style.overflow = 'hidden';
    }
    function closeVideo() {
      const m = document.getElementById('asm-video-modal');
      if (m) m.remove();   // removing the iframe stops playback
      document.body.style.overflow = document.getElementById('asm-fullpage') ? 'hidden' : '';
    }



    let _modalImages = [];
    let _modalIndex = 0;
    function openImageModal(instanceId, index) {
      const inst = ctx.getSbs().find(i => i.instanceId === instanceId);
      const schema = inst ? ctx.getSchemas()[inst.itemId] : null;
      _modalImages = (schema && schema.referenceImages) ? schema.referenceImages.map(im => im.base64) : [];
      if (!_modalImages.length && typeof instanceId === 'string' && instanceId.startsWith('data:')) {
        _modalImages = [instanceId]; // fallback: raw base64 passed
      }
      _modalIndex = index || 0;
      _showModalImage();
      const modal = document.getElementById('asm-modal');
      if (modal) { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
    }
    function _showModalImage() {
      const img = document.getElementById('asm-modal-image');
      if (img && _modalImages[_modalIndex]) img.src = _modalImages[_modalIndex];
      const prev = document.getElementById('asm-modal-prev');
      const next = document.getElementById('asm-modal-next');
      const multi = _modalImages.length > 1;
      if (prev) prev.style.display = multi ? 'flex' : 'none';
      if (next) next.style.display = multi ? 'flex' : 'none';
    }
    function modalNav(dir) {
      if (!_modalImages.length) return;
      _modalIndex = (_modalIndex + dir + _modalImages.length) % _modalImages.length;
      _showModalImage();
    }

    function closeImageModal() {
      const modal = document.getElementById('asm-modal');
      if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
    }

    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('asm-modal');
      if (!modal || !modal.classList.contains('show')) return;
      if (e.key === 'Escape') closeImageModal();
      else if (e.key === 'ArrowLeft') modalNav(-1);
      else if (e.key === 'ArrowRight') modalNav(1);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('asm-video-modal')) closeVideo();
    });

    return {
      buildVideoBtn: buildVideoBtn, openVideo: openVideo, closeVideo: closeVideo,
      openImageModal: openImageModal, modalNav: modalNav, closeImageModal: closeImageModal
    };
  }

  window.ASMMedia = { create: create };
})();
