/**
 * Universal Photo Viewer & Editor Modal
 * Supports: view, edit (author), likes, comments (all users), real-time updates
 */
import { getCurrentUserId, getCurrentDisplayName } from '../services/authService.js';
import { getActiveGroupCode } from '../services/groupService.js';
import {
  updatePhotoDocument,
  deletePhoto,
  toggleLike,
  subscribeToLikes,
  addComment,
  deleteComment,
  subscribeToComments
} from '../services/firebase.js';
import { showToast } from '../utils/toast.js';

const AVAILABLE_EMOJIS = [
  '📸', '🌅', '🏖️', '🌲', '🏰', '☕', '🍕', '🏕️', '🎨', '🐾',
  '🌸', '🚴', '⛵', '🏙️', '🍦', '🧗', '🚗', '🚀', '🌌', '💡', '❤️'
];

/**
 * Format relative time from a Firestore Timestamp or date value
 */
function formatRelativeTime(createdAt) {
  try {
    if (!createdAt) return '';
    const d = createdAt.toDate
      ? createdAt.toDate()
      : new Date(createdAt.seconds ? createdAt.seconds * 1000 : createdAt);
    if (isNaN(d.getTime())) return '';

    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'щойно';
    if (diff < 3600) return `${Math.floor(diff / 60)} хв`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} год`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} дн`;
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  } catch (_) {
    return '';
  }
}

/**
 * Get initial letters for avatar
 */
function getAvatarInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

/**
 * Open the universal photo viewer
 * @param {Object} photo - The photo document
 * @param {Function} [onChanged] - Callback when photo is edited or deleted
 */
export function showPhotoViewer(photo, onChanged) {
  if (!photo) return;

  // Remove any existing viewer modal immediately
  const existing = document.getElementById('universal-photo-viewer');
  if (existing) existing.remove();

  const currentUserId = getCurrentUserId();
  const currentUserName = getCurrentDisplayName();
  const isAuthor = Boolean(photo.userId && currentUserId && photo.userId === currentUserId);
  const activeGroup = getActiveGroupCode();

  // Format date
  let dateString = 'Нещодавно';
  try {
    if (photo.createdAt) {
      const d = photo.createdAt.toDate
        ? photo.createdAt.toDate()
        : new Date(photo.createdAt.seconds ? photo.createdAt.seconds * 1000 : photo.createdAt);
      if (!isNaN(d.getTime())) {
        dateString = d.toLocaleDateString('uk-UA', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      }
    }
  } catch (_) {}

  // — Modal state —
  let isEditMode = false;
  let currentEmoji = photo.emoji || '📸';

  // — Reactions state —
  let likes = [];
  let comments = [];
  let isLiked = false;
  let isLiking = false;
  let likesUnsub = null;
  let commentsUnsub = null;

  // ─── Modal element ───────────────────────────────
  const modal = document.createElement('div');
  modal.id = 'universal-photo-viewer';
  modal.className = 'pv-overlay';

  // Append modal to body immediately so selectors and events always resolve
  document.body.appendChild(modal);

  // ─── Render ──────────────────────────────────────
  function render() {
    modal.innerHTML = `
      <div class="pv-backdrop" data-action="close"></div>
      <div class="pv-card" role="dialog" aria-modal="true">

        <!-- Header -->
        <div class="pv-header">
          <div class="pv-title-row">
            <span class="pv-emoji-icon">${currentEmoji}</span>
            <div>
              <div class="pv-title-text">${photo.description
                ? photo.description.slice(0, 35) + (photo.description.length > 35 ? '…' : '')
                : 'Фотографія на карті'}</div>
              <div class="pv-subtitle-text">
                ${photo.groupCode
                  ? `👥 Група: <strong>${photo.groupCode}</strong>`
                  : '🌍 Публічна фотографія'}
              </div>
            </div>
          </div>
          <button type="button" class="pv-close-btn" data-action="close" aria-label="Закрити">&times;</button>
        </div>

        <!-- Body -->
        <div class="pv-body">

          <!-- Image -->
          <div class="pv-image-wrap">
            <img src="${photo.mainUrl || photo.thumbUrl}"
                 alt="${photo.description || 'Фото'}"
                 class="pv-image" loading="eager" />
          </div>

          <!-- Reactions bar (hidden in edit mode) -->
          ${!isEditMode ? `
            <div class="pv-reactions-bar">
              <button class="pv-like-btn${isLiked ? ' liked' : ''}" id="pv-like-btn"
                      aria-label="Подобається" title="${isLiked ? 'Прибрати лайк' : 'Подобається'}">
                <span class="pv-like-icon">${isLiked ? '❤️' : '🤍'}</span>
                <span class="pv-like-count" id="pv-likes-count">${likes.length}</span>
              </button>
              <span class="pv-comments-badge">
                <span>💬</span>
                <span id="pv-comments-count">${comments.length}</span>
              </span>
            </div>
          ` : ''}

          <!-- View mode details -->
          <div class="pv-details" style="display:${isEditMode ? 'none' : 'flex'};">
            <p class="pv-description">${photo.description || '<span style="color:var(--text-muted)">Без опису</span>'}</p>
            <div class="pv-meta-grid">
              <div class="pv-meta-item">
                <span class="pv-meta-label">Автор</span>
                <span class="pv-meta-val">👤 ${photo.authorName || 'Мандрівник'}</span>
              </div>
              <div class="pv-meta-item">
                <span class="pv-meta-label">Дата</span>
                <span class="pv-meta-val">📅 ${dateString}</span>
              </div>
              <div class="pv-meta-item">
                <span class="pv-meta-label">Видимість</span>
                <span class="pv-meta-val">${photo.groupCode ? `👥 ${photo.groupCode}` : '🌍 Всі'}</span>
              </div>
            </div>
          </div>

          <!-- Edit mode form (author only) -->
          ${isAuthor ? `
            <div class="pv-edit-form" style="display:${isEditMode ? 'flex' : 'none'};">
              <div class="pv-form-group">
                <label class="pv-label">Опис фотографії:</label>
                <textarea id="pv-edit-desc" class="pv-textarea" rows="2" maxlength="250"
                          placeholder="Введіть опис...">${photo.description || ''}</textarea>
              </div>
              <div class="pv-form-group">
                <label class="pv-label">Хто бачить це фото:</label>
                <select id="pv-edit-visibility" class="pv-select">
                  <option value="" ${!photo.groupCode ? 'selected' : ''}>🌍 Всі користувачі (Публічно)</option>
                  ${activeGroup ? `
                    <option value="${activeGroup}" ${photo.groupCode === activeGroup ? 'selected' : ''}>
                      👥 Тільки група (${activeGroup})
                    </option>
                  ` : ''}
                  ${photo.groupCode && photo.groupCode !== activeGroup ? `
                    <option value="${photo.groupCode}" selected>
                      👥 Тільки група (${photo.groupCode})
                    </option>
                  ` : ''}
                </select>
              </div>
              <div class="pv-form-group">
                <label class="pv-label">Іконка мітки:</label>
                <div class="pv-emoji-grid">
                  ${AVAILABLE_EMOJIS.map(e => `
                    <button type="button" class="pv-emoji-btn ${e === currentEmoji ? 'active' : ''}"
                            data-emoji="${e}">${e}</button>
                  `).join('')}
                </div>
              </div>
              <div class="pv-edit-actions">
                <button type="button" class="pv-btn pv-btn-ghost" data-action="cancel-edit">Скасувати</button>
                <button type="button" class="pv-btn pv-btn-primary" id="pv-btn-save">Зберегти зміни</button>
              </div>
            </div>
          ` : ''}

          <!-- Comments section (hidden in edit mode) -->
          ${!isEditMode ? `
            <div class="pv-comments-section">
              <div class="pv-comments-header">
                <span>💬 Коментарі</span>
                ${comments.length > 0 ? `<span class="pv-comments-count-label">${comments.length}</span>` : ''}
              </div>

              <div class="pv-comments-list" id="pv-comments-list">
                ${renderCommentsList()}
              </div>

              <div class="pv-comment-input-row">
                <div class="pv-comment-avatar-mini">${getAvatarInitial(currentUserName)}</div>
                <input type="text" id="pv-comment-input" class="pv-comment-input"
                       placeholder="Написати коментар…" maxlength="300"
                       autocomplete="off" autocorrect="off" />
                <button type="button" class="pv-send-btn" id="pv-send-comment" aria-label="Надіслати">
                  ➤
                </button>
              </div>
            </div>
          ` : ''}

        </div>

        <!-- Footer -->
        <div class="pv-footer">
          <div class="pv-footer-left">
            ${isAuthor && !isEditMode ? `
              <button type="button" class="pv-btn pv-btn-secondary" data-action="start-edit">
                ✏️ Редагувати
              </button>
              <button type="button" class="pv-btn pv-btn-danger" id="pv-btn-delete" title="Видалити фото">
                🗑️
              </button>
            ` : ''}
          </div>
          <button type="button" class="pv-btn pv-btn-secondary" data-action="close">Закрити</button>
        </div>

      </div>
    `;

    bindEvents();
    refreshLikesUI();
    refreshCommentsUI();
  }

  // ─── Render comment list HTML ────────────────────
  function renderCommentsList() {
    if (comments.length === 0) {
      return `<p class="pv-comments-empty">Будьте першим! Залиште коментар ✨</p>`;
    }
    return comments.map(c => {
      const canDelete = c.userId === currentUserId || isAuthor;
      const timeStr = formatRelativeTime(c.createdAt);
      return `
        <div class="pv-comment-item" data-comment-id="${c.id}">
          <div class="pv-comment-avatar">${getAvatarInitial(c.userName)}</div>
          <div class="pv-comment-body">
            <div class="pv-comment-meta">
              <span class="pv-comment-author">${c.userName || 'Мандрівник'}</span>
              ${timeStr ? `<span class="pv-comment-time">${timeStr}</span>` : ''}
            </div>
            <p class="pv-comment-text">${c.text}</p>
          </div>
          ${canDelete ? `
            <button class="pv-comment-delete-btn" data-comment-id="${c.id}"
                    title="Видалити коментар" aria-label="Видалити">×</button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // ─── Refresh likes UI without full re-render ─────
  function refreshLikesUI() {
    const btn = modal.querySelector('#pv-like-btn');
    const countEl = modal.querySelector('#pv-likes-count');
    if (btn) {
      btn.className = `pv-like-btn${isLiked ? ' liked' : ''}`;
      btn.title = isLiked ? 'Прибрати лайк' : 'Подобається';
      const icon = btn.querySelector('.pv-like-icon');
      if (icon) icon.textContent = isLiked ? '❤️' : '🤍';
      btn.onclick = handleLike;
    }
    if (countEl) countEl.textContent = likes.length;
  }

  // ─── Refresh comments UI without full re-render ──
  function refreshCommentsUI() {
    const list = modal.querySelector('#pv-comments-list');
    const countEl = modal.querySelector('#pv-comments-count');
    const headerCountEl = modal.querySelector('.pv-comments-count-label');

    if (countEl) countEl.textContent = comments.length;
    if (headerCountEl) headerCountEl.textContent = comments.length;
    if (list) {
      list.innerHTML = renderCommentsList();
      bindCommentDeleteButtons(list);
      list.scrollTop = list.scrollHeight;
    }
  }

  // ─── Bind comment delete buttons ─────────────────
  function bindCommentDeleteButtons(container) {
    (container || modal).querySelectorAll('.pv-comment-delete-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const commentId = btn.dataset.commentId;
        if (!commentId) return;
        // Optimistic remove from local state
        comments = comments.filter(c => c.id !== commentId);
        refreshCommentsUI();
        await deleteComment(photo.id, commentId);
      };
    });
  }

  // ─── Handle like toggle ───────────────────────────
  async function handleLike() {
    if (isLiking) return;
    isLiking = true;

    // Optimistic update
    if (isLiked) {
      isLiked = false;
      likes = likes.filter(l => l.userId !== currentUserId);
    } else {
      isLiked = true;
      likes = [...likes, { userId: currentUserId, userName: currentUserName }];
    }
    refreshLikesUI();

    // Animate pop
    const btn = modal.querySelector('#pv-like-btn');
    if (btn) {
      btn.classList.add('pv-like-anim');
      setTimeout(() => btn.classList.remove('pv-like-anim'), 350);
    }

    await toggleLike(photo.id, currentUserId, currentUserName);
    isLiking = false;
  }

  // ─── Handle send comment ──────────────────────────
  async function handleSendComment() {
    const input = modal.querySelector('#pv-comment-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const sendBtn = modal.querySelector('#pv-send-comment');
    if (sendBtn) sendBtn.disabled = true;
    input.disabled = true;

    // Optimistic comment insert
    const tempId = `temp_${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      photoId: photo.id,
      userId: currentUserId,
      userName: currentUserName,
      text,
      createdAt: new Date().toISOString()
    };
    comments = [...comments, optimisticComment];
    refreshCommentsUI();
    input.value = '';

    try {
      const id = await addComment(photo.id, {
        userId: currentUserId,
        userName: currentUserName,
        text
      });

      if (!id) {
        // Rollback optimistic comment
        comments = comments.filter(c => c.id !== tempId);
        refreshCommentsUI();
        showToast('Не вдалося надіслати коментар', 'error');
      }
    } catch (err) {
      console.error('Send comment error:', err);
      comments = comments.filter(c => c.id !== tempId);
      refreshCommentsUI();
      showToast('Помилка відправки коментаря', 'error');
    } finally {
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  }

  // ─── Bind all events ─────────────────────────────
  function bindEvents() {
    // Close
    modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.onclick = close;
    });

    // Edit mode toggle
    const btnStartEdit = modal.querySelector('[data-action="start-edit"]');
    if (btnStartEdit) {
      btnStartEdit.onclick = () => { isEditMode = true; render(); };
    }
    const btnCancelEdit = modal.querySelector('[data-action="cancel-edit"]');
    if (btnCancelEdit) {
      btnCancelEdit.onclick = () => { isEditMode = false; render(); };
    }

    // Emoji picker
    modal.querySelectorAll('.pv-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        currentEmoji = btn.dataset.emoji;
        modal.querySelectorAll('.pv-emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // Save changes
    const btnSave = modal.querySelector('#pv-btn-save');
    if (btnSave) {
      btnSave.onclick = async () => {
        const descInput = modal.querySelector('#pv-edit-desc');
        const visInput = modal.querySelector('#pv-edit-visibility');
        const newDesc = descInput ? descInput.value.trim() : '';
        const newVis = visInput ? visInput.value.trim() : '';

        btnSave.disabled = true;
        btnSave.textContent = 'Збереження…';

        try {
          await updatePhotoDocument(photo.id, {
            description: newDesc,
            groupCode: newVis || null,
            emoji: currentEmoji
          });
          photo.description = newDesc;
          photo.groupCode = newVis || null;
          photo.emoji = currentEmoji;
          showToast('Фото оновлено! ✨', 'success');
          isEditMode = false;
          render();
          if (typeof onChanged === 'function') onChanged('update', photo);
        } catch (err) {
          console.error('Update error:', err);
          showToast('Помилка оновлення', 'error');
          btnSave.disabled = false;
          btnSave.textContent = 'Зберегти зміни';
        }
      };
    }

    // Delete photo
    const btnDelete = modal.querySelector('#pv-btn-delete');
    if (btnDelete) {
      btnDelete.onclick = async () => {
        if (confirm('Видалити цю фотографію з карти назавжди?')) {
          try {
            await deletePhoto(photo);
            showToast('Фото видалено', 'info');
            close();
            if (typeof onChanged === 'function') onChanged('delete', photo);
          } catch (err) {
            console.error('Delete error:', err);
            showToast('Помилка видалення', 'error');
          }
        }
      };
    }

    // Like button
    const likeBtn = modal.querySelector('#pv-like-btn');
    if (likeBtn) likeBtn.onclick = handleLike;

    // Comment send button
    const sendBtn = modal.querySelector('#pv-send-comment');
    if (sendBtn) sendBtn.onclick = handleSendComment;

    // Comment input — Enter to send
    const commentInput = modal.querySelector('#pv-comment-input');
    if (commentInput) {
      commentInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendComment();
        }
      };
    }

    // Comment delete buttons
    bindCommentDeleteButtons();
  }

  // ─── Close & cleanup ──────────────────────────────
  function close() {
    if (likesUnsub) { likesUnsub(); likesUnsub = null; }
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    window.removeEventListener('keydown', onKeyDown);
    modal.remove();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }

  // ─── Launch ───────────────────────────────────────
  window.addEventListener('keydown', onKeyDown);
  render();

  // Start real-time subscriptions
  likesUnsub = subscribeToLikes(photo.id, (newLikes) => {
    likes = newLikes;
    isLiked = newLikes.some(l => l.userId === currentUserId);
    refreshLikesUI();
  });

  commentsUnsub = subscribeToComments(photo.id, (newComments) => {
    comments = newComments;
    refreshCommentsUI();
  });
}
