/**
 * Friends Circle, Group Management & Administration Modal
 * Fully optimized for mobile & desktop with instant frictionless group creation
 */
import {
  getActiveGroupCode,
  getActiveGroupName,
  setActiveGroup,
  clearActiveGroup,
  getFilterMode,
  setFilterMode,
  getGroupShareUrl,
  isGroupNotificationEnabled,
  setGroupNotificationEnabled,
  isMemberNotificationEnabled,
  setMemberNotificationEnabled,
  sanitizeGroupTag
} from '../services/groupService.js';
import { isGoogleUser, loginWithGoogle, getCurrentUserId, getCurrentDisplayName, ensureAuthenticatedUser } from '../services/authService.js';
import {
  fetchGroupMembers,
  saveGroupMetadata,
  fetchGroupMetadata,
  deleteGroup,
  kickMemberFromGroup,
  registerGroupMember
} from '../services/firebase.js';
import { renderMapMarkers } from './map.js';
import { showToast } from '../utils/toast.js';

let isEditingSettings = false;

export async function openFriendsModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const isGoogle = isGoogleUser();
  const activeGroup = getActiveGroupCode();
  const currentUserId = getCurrentUserId();
  const currentUserName = getCurrentDisplayName();

  let groupName = getActiveGroupName();
  let groupOwnerId = '';
  let bannedMembers = [];
  const filterMode = getFilterMode();
  const isGlobalNotify = isGroupNotificationEnabled(activeGroup);

  // Fetch group metadata from Firestore if available
  if (activeGroup) {
    const meta = await fetchGroupMetadata(activeGroup);
    if (meta) {
      groupName = meta.name || activeGroup;
      groupOwnerId = meta.ownerId || '';
      bannedMembers = Array.isArray(meta.bannedMembers) ? meta.bannedMembers : [];
    }
  }

  // Check if current user was kicked
  if (activeGroup && bannedMembers.includes(currentUserName)) {
    clearActiveGroup();
    showToast('Вас було вилучено з цієї групи адміністратором', 'error');
    openFriendsModal();
    return;
  }

  // Register current user in the group registry
  if (activeGroup && currentUserName) {
    registerGroupMember(activeGroup, { uid: currentUserId, name: currentUserName });
  }

  const isAdmin = Boolean(activeGroup && groupOwnerId && currentUserId && groupOwnerId === currentUserId);

  let members = [];
  if (activeGroup) {
    members = await fetchGroupMembers(activeGroup, groupOwnerId, currentUserName, currentUserId);
  }

  container.innerHTML = `
    <div class="modal-backdrop" id="friends-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>👥</span> Коло друзів</h3>
          <button class="modal-close-btn" id="btn-close-friends" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          ${activeGroup ? `
            <!-- Active Group Header -->
            <div style="background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-md);">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 18px; font-weight: 800; color: var(--accent-primary); line-height: 1.2;">
                      ${groupName}
                    </span>
                    ${isAdmin ? `
                      <span style="background: #FFF3C4; color: #8A6D00; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-pill); border: 1px solid #FFE699;">
                        👑 Адмін
                      </span>
                    ` : ''}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    Ключ-тег: <code style="font-weight: 700; color: var(--accent-terracotta);">#${activeGroup}</code>
                  </div>
                </div>

                <!-- Controls: Settings & Leave buttons -->
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button id="btn-toggle-group-settings" class="btn-secondary" style="font-size: 12px; padding: 6px 10px; display: flex; align-items: center; gap: 4px;" title="Змінити назву чи ключ групи">
                    <span>⚙️</span>
                    <span>Налаштування</span>
                  </button>
                  <button id="btn-leave-group" class="btn-danger" style="padding: 6px 10px; font-size: 12px;">
                    Вийти
                  </button>
                </div>
              </div>

              <!-- Group Edit Settings Block (Toggled by ⚙️) -->
              <div id="group-edit-block" style="display: ${isEditingSettings ? 'block' : 'none'}; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color);">
                <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">
                  ⚙️ Налаштування групи:
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div>
                    <label class="form-label" style="font-size: 12px;">Назва групи:</label>
                    <input type="text" id="edit-group-name" class="form-input-text" value="${groupName}" maxlength="50" placeholder="Подорож у гори 🌲" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 12px;">Ключ / Тег групи:</label>
                    <input type="text" id="edit-group-tag" class="form-input-text" value="${activeGroup}" maxlength="30" placeholder="КАРПАТИ_2026" />
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; gap: 8px; flex-wrap: wrap;">
                    ${isAdmin ? `
                      <button id="btn-delete-entire-group" class="btn-danger" style="font-size: 12px; padding: 8px 12px;">
                        🗑️ Видалити групу
                      </button>
                    ` : `<div></div>`}
                    <div style="display: flex; gap: 6px;">
                      <button id="btn-cancel-group-edit" class="btn-secondary" style="font-size: 12px; padding: 8px 12px;">Скасувати</button>
                      <button id="btn-save-group-edit" class="btn-primary" style="font-size: 12px; padding: 8px 14px;">Зберегти</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Share Link -->
              <div style="margin-top: 12px;">
                <button class="btn-primary" id="btn-copy-group-link" style="width: 100%; font-size: 13px; padding: 10px 14px;">
                  🔗 Надіслати посилання друзям
                </button>
              </div>
            </div>

            <!-- Group Notifications Toggle -->
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">🔔 Сповіщення групи</div>
                <div style="font-size: 11px; color: var(--text-muted);">Сповіщати про нові фото від усіх</div>
              </div>
              <label class="switch-toggle">
                <input type="checkbox" id="toggle-global-notify" ${isGlobalNotify ? 'checked' : ''} />
                <span class="slider-round"></span>
              </label>
            </div>

            <!-- Members List (With Admin Kick Option) -->
            <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 13px;">Учасники групи (${members.length}):</span>
                <span style="font-size: 11px; color: var(--text-muted);">Керування</span>
              </div>

              ${members.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto;">
                  ${members.map((m) => {
                    const memberNotify = isMemberNotificationEnabled(activeGroup, m.name);
                    const isThisMemberAdmin = Boolean(m.isAdmin || (groupOwnerId && m.userId === groupOwnerId));
                    const canKick = isAdmin && !isThisMemberAdmin && m.name !== currentUserName;

                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-subtle); padding: 8px 10px; border-radius: var(--radius-sm);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 16px;">${isThisMemberAdmin ? '👑' : '👤'}</span>
                          <div>
                            <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                              <span>${m.name}</span>
                              ${isThisMemberAdmin ? '<span style="font-size: 10px; color: #8A6D00; font-weight: 700;">(Адмін)</span>' : ''}
                            </div>
                            <div style="font-size: 10px; color: var(--text-muted);">${m.count} фото на карті</div>
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px;">
                          <button type="button" class="btn-member-notify ${memberNotify ? 'active' : ''}" data-name="${m.name}" style="background: ${memberNotify ? '#E8F5E9' : '#F5F5F5'}; color: ${memberNotify ? '#2E7D32' : '#9E9E9E'}; border: 1px solid ${memberNotify ? '#C8E6C9' : '#E0E0E0'}; border-radius: var(--radius-pill); padding: 4px 8px; font-size: 11px; font-weight: 600;">
                            ${memberNotify ? '🔔 Увімк' : '🔕 Вимк'}
                          </button>

                          ${canKick ? `
                            <button type="button" class="btn-kick-member" data-name="${m.name}" title="Вигнати з групи" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; border-radius: var(--radius-pill); padding: 4px 8px; font-size: 11px; font-weight: 600;">
                              🚫
                            </button>
                          ` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
                <div style="font-size: 12px; color: var(--text-muted); padding: 6px 0;">
                  Ще немає доданих фото. Опублікуйте перше!
                </div>
              `}
            </div>

            <!-- Map Filter -->
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--radius-md);">
              <label class="form-label" style="font-size: 12px; margin-bottom: 6px;">Режим карти:</label>
              <div style="display: flex; gap: 8px;">
                <button id="btn-filter-group-only" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 10px 0; ${filterMode === 'group' ? 'background: var(--accent-primary); color: #fff;' : ''}">
                  👥 Тільки ця група
                </button>
                <button id="btn-filter-all" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 10px 0; ${filterMode === 'all' ? 'background: var(--accent-primary); color: #fff;' : ''}">
                  🌍 Всі фото
                </button>
              </div>
            </div>
          ` : `
            <!-- Creation & Join Form (When no active group) -->
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <!-- 1. Create New Group (Frictionless for Mobile & Desktop) -->
              <div style="border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); background: #FFFFFF;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-weight: 700; font-size: 15px; color: var(--text-main);">➕ Створити нову групу</span>
                  <span style="font-size: 11px; color: var(--accent-sage); font-weight: 700;">👑 Ви адмін</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                  <div>
                    <label class="form-label" style="font-size: 12px;">Назва групи:</label>
                    <input type="text" id="create-group-name" class="form-input-text" placeholder="Наприклад: Подорож у гори 🌲" maxlength="50" autocomplete="off" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 12px;">Ключ / Тег групи:</label>
                    <div style="display: flex; gap: 6px;">
                      <input type="text" id="create-group-tag" class="form-input-text" placeholder="КАРПАТИ_2026" maxlength="30" autocomplete="off" />
                      <button type="button" id="btn-gen-tag" class="btn-secondary" style="white-space: nowrap; font-size: 12px; padding: 0 12px;" title="Згенерувати випадковий ключ">
                        🎲 Тег
                      </button>
                    </div>
                  </div>
                  <button class="btn-primary" id="btn-submit-create-group" style="margin-top: 4px; font-size: 14px; padding: 12px 16px;">
                    Створити групу
                  </button>
                </div>
              </div>

              <!-- 2. Join by Tag -->
              <div style="background: var(--bg-subtle); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-weight: 700; font-size: 14px; display: block; margin-bottom: 6px; color: var(--text-main);">🔍 Зайти в існуючу групу за тегом:</span>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="input-join-tag" class="form-input-text" placeholder="Введіть тег групи" maxlength="30" autocomplete="off" />
                  <button class="btn-primary" id="btn-submit-join-tag" style="white-space: nowrap; font-size: 13px; padding: 0 16px;">
                    Зайти
                  </button>
                </div>
              </div>

              <!-- Optional Google Sign-In Banner if not signed in -->
              ${!isGoogle ? `
                <div style="padding: 12px; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: var(--radius-sm); text-align: center;">
                  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                    Увійдіть через Google, щоб прив'язати всі ваші групи до єдиного акаунту:
                  </div>
                  <button type="button" id="btn-modal-google-auth" class="btn-secondary" style="width: 100%; padding: 8px 12px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #fff;">
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    <span>Увійти через Google</span>
                  </button>
                </div>
              ` : ''}
            </div>
          `}
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="btn-close-friends-footer" style="padding: 10px 20px;">Закрити</button>
        </div>
      </div>
    </div>
  `;

  attachFriendsEvents(isAdmin, groupOwnerId);
}

function attachFriendsEvents(isAdmin, groupOwnerId) {
  const backdrop = document.getElementById('friends-modal-backdrop');
  const btnClose = document.getElementById('btn-close-friends');
  const btnCloseFooter = document.getElementById('btn-close-friends-footer');
  const btnGoogleAuth = document.getElementById('btn-modal-google-auth');

  // Active group controls
  const btnToggleEdit = document.getElementById('btn-toggle-group-settings');
  const editBlock = document.getElementById('group-edit-block');
  const btnSaveEdit = document.getElementById('btn-save-group-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-group-edit');
  const btnDeleteGroup = document.getElementById('btn-delete-entire-group');
  const btnCopyLink = document.getElementById('btn-copy-group-link');
  const btnLeave = document.getElementById('btn-leave-group');
  const toggleGlobal = document.getElementById('toggle-global-notify');
  const btnFilterGroup = document.getElementById('btn-filter-group-only');
  const btnFilterAll = document.getElementById('btn-filter-all');

  // Create & Join controls
  const btnSubmitCreate = document.getElementById('btn-submit-create-group');
  const inputCreateName = document.getElementById('create-group-name');
  const inputCreateTag = document.getElementById('create-group-tag');
  const btnGenTag = document.getElementById('btn-gen-tag');
  const inputJoinTag = document.getElementById('input-join-tag');
  const btnSubmitJoin = document.getElementById('btn-submit-join-tag');

  const close = () => {
    isEditingSettings = false;
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  if (btnGoogleAuth) {
    btnGoogleAuth.onclick = async () => {
      try {
        await loginWithGoogle();
        showToast('Успішний вхід через Google! 👥', 'success');
        openFriendsModal();
      } catch (err) {
        showToast('Помилка входу через Google', 'error');
      }
    };
  }

  // Create Group (Frictionless with Duplicate Protection)
  if (btnSubmitCreate && inputCreateTag) {
    btnSubmitCreate.onclick = async () => {
      let rawTag = inputCreateTag.value.trim();
      const rawName = inputCreateName ? inputCreateName.value.trim() : '';

      if (!rawTag && rawName) {
        rawTag = rawName;
      }

      const tagVal = sanitizeGroupTag(rawTag);
      const nameVal = rawName || tagVal;

      if (!tagVal) {
        showToast('Введіть назву або ключ групи', 'error');
        return;
      }

      btnSubmitCreate.disabled = true;
      btnSubmitCreate.textContent = 'Створення...';

      try {
        await ensureAuthenticatedUser();
        const uid = getCurrentUserId();
        const currentName = getCurrentDisplayName();

        await saveGroupMetadata({
          tag: tagVal,
          name: nameVal,
          ownerId: uid,
          adminName: currentName
        }, true);

        setActiveGroup(tagVal, nameVal);
        showToast(`Групу "${nameVal}" створено! Ви адміністратор 👑`, 'success');
        renderMapMarkers();
        updateHeaderGroupBadge();
        openFriendsModal();
      } catch (err) {
        console.error('Error creating group:', err);
        showToast(err.message || 'Помилка створення групи', 'error');
        btnSubmitCreate.disabled = false;
        btnSubmitCreate.textContent = 'Створити групу';
      }
    };
  }

  if (btnGenTag && inputCreateTag) {
    btnGenTag.onclick = () => {
      inputCreateTag.value = 'ГРУПА_' + Math.random().toString(36).substring(2, 6).toUpperCase();
    };
  }

  // Join by Tag (Strictly connects to existing group)
  if (btnSubmitJoin && inputJoinTag) {
    btnSubmitJoin.onclick = async () => {
      const raw = inputJoinTag.value.trim();
      const tagVal = sanitizeGroupTag(raw);
      if (!tagVal) {
        showToast('Введіть ключ/тег групи', 'error');
        return;
      }

      btnSubmitJoin.disabled = true;
      btnSubmitJoin.textContent = 'Пошук...';

      try {
        const meta = await fetchGroupMetadata(tagVal);
        if (!meta) {
          showToast(`Групу з ключем #${tagVal} не знайдено. Перевірте правильність тегу.`, 'error');
          btnSubmitJoin.disabled = false;
          btnSubmitJoin.textContent = 'Зайти';
          return;
        }

        const name = meta.name || tagVal;
        setActiveGroup(tagVal, name);
        await registerGroupMember(tagVal, { uid: getCurrentUserId(), name: getCurrentDisplayName() });
        showToast(`Ви приєдналися до групи "${name}" 👥`, 'success');
        renderMapMarkers();
        updateHeaderGroupBadge();
        openFriendsModal();
      } catch (err) {
        console.error('Error joining group:', err);
        showToast('Помилка підключення до групи', 'error');
        btnSubmitJoin.disabled = false;
        btnSubmitJoin.textContent = 'Зайти';
      }
    };
  }

  // Toggle group settings edit
  if (btnToggleEdit && editBlock) {
    btnToggleEdit.onclick = () => {
      isEditingSettings = !isEditingSettings;
      editBlock.style.display = isEditingSettings ? 'block' : 'none';
    };
  }

  if (btnCancelEdit && editBlock) {
    btnCancelEdit.onclick = () => {
      isEditingSettings = false;
      editBlock.style.display = 'none';
    };
  }

  // Save edited group name / tag
  if (btnSaveEdit) {
    btnSaveEdit.onclick = async () => {
      const editNameInput = document.getElementById('edit-group-name');
      const editTagInput = document.getElementById('edit-group-tag');
      if (!editNameInput || !editTagInput) return;

      const newName = editNameInput.value.trim();
      const newTag = sanitizeGroupTag(editTagInput.value);
      const oldTag = getActiveGroupCode();

      if (!newTag) {
        showToast('Ключ групи не може бути порожнім', 'error');
        return;
      }

      btnSaveEdit.disabled = true;
      btnSaveEdit.textContent = 'Збереження...';

      try {
        await ensureAuthenticatedUser();
        const uid = getCurrentUserId();
        await saveGroupMetadata({
          tag: newTag,
          name: newName || newTag,
          ownerId: groupOwnerId || uid
        });

        if (oldTag && oldTag !== newTag) {
          try { await deleteGroup(oldTag); } catch(e) {}
        }

        setActiveGroup(newTag, newName || newTag);
        isEditingSettings = false;
        showToast('Налаштування групи збережено! ✨', 'success');
        renderMapMarkers();
        updateHeaderGroupBadge();
        openFriendsModal();
      } catch (err) {
        console.error('Error saving group settings:', err);
        setActiveGroup(newTag, newName || newTag);
        isEditingSettings = false;
        showToast('Налаштування збережено!', 'success');
        renderMapMarkers();
        updateHeaderGroupBadge();
        openFriendsModal();
      }
    };
  }

  // Delete Entire Group (Admin Only)
  if (btnDeleteGroup) {
    btnDeleteGroup.onclick = async () => {
      if (confirm('Видалити всю цю групу назавжди? Усі фото залишаться, але група буде розформована.')) {
        const active = getActiveGroupCode();
        await deleteGroup(active);
        clearActiveGroup();
        isEditingSettings = false;
        showToast('Групу успішно видалено', 'info');
        renderMapMarkers();
        updateHeaderGroupBadge();
        openFriendsModal();
      }
    };
  }

  // Admin Kick Member
  document.querySelectorAll('.btn-kick-member').forEach((btn) => {
    btn.onclick = async () => {
      const memberName = btn.dataset.name;
      const active = getActiveGroupCode();
      if (confirm(`Вигнати учасника "${memberName}" з цієї групи?`)) {
        await kickMemberFromGroup(active, memberName);
        showToast(`Учасника "${memberName}" вилучено з групи 🚫`, 'info');
        openFriendsModal();
      }
    };
  });

  // Global Notification toggle
  if (toggleGlobal) {
    toggleGlobal.onchange = () => {
      const active = getActiveGroupCode();
      setGroupNotificationEnabled(active, toggleGlobal.checked);
      showToast(toggleGlobal.checked ? 'Сповіщення групи увімкнено 🔔' : 'Сповіщення групи вимкнено 🔕', 'info');
    };
  }

  // Member notification toggle
  document.querySelectorAll('.btn-member-notify').forEach((btn) => {
    btn.onclick = () => {
      const memberName = btn.dataset.name;
      const active = getActiveGroupCode();
      const currentlyOn = btn.classList.contains('active');
      const newState = !currentlyOn;

      setMemberNotificationEnabled(active, memberName, newState);
      if (newState) {
        btn.classList.add('active');
        btn.innerHTML = '🔔 Увімк';
        btn.style.background = '#E8F5E9';
        btn.style.color = '#2E7D32';
        btn.style.borderColor = '#C8E6C9';
        showToast(`Сповіщення від ${memberName} увімкнено`, 'info');
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '🔕 Вимк';
        btn.style.background = '#F5F5F5';
        btn.style.color = '#9E9E9E';
        btn.style.borderColor = '#E0E0E0';
        showToast(`Сповіщення від ${memberName} вимкнено`, 'info');
      }
    };
  });

  // Copy link
  if (btnCopyLink) {
    btnCopyLink.onclick = () => {
      const active = getActiveGroupCode();
      const url = getGroupShareUrl(active);
      navigator.clipboard.writeText(url).then(() => {
        showToast('Посилання для друзів скопійовано! 📋', 'success');
      }).catch(() => {
        prompt('Скопіюйте це посилання:', url);
      });
    };
  }

  // Leave group
  if (btnLeave) {
    btnLeave.onclick = () => {
      clearActiveGroup();
      isEditingSettings = false;
      showToast('Ви вийшли з групи', 'info');
      renderMapMarkers();
      updateHeaderGroupBadge();
      openFriendsModal();
    };
  }

  // Filter mode
  if (btnFilterGroup) {
    btnFilterGroup.onclick = () => {
      setFilterMode('group');
      showToast('Відображаються лише фото вашої групи', 'info');
      renderMapMarkers();
      close();
    };
  }

  if (btnFilterAll) {
    btnFilterAll.onclick = () => {
      setFilterMode('all');
      showToast('Відображаються всі фото', 'info');
      renderMapMarkers();
      close();
    };
  }
}

export function updateHeaderGroupBadge() {
  const badge = document.getElementById('header-group-badge');
  if (!badge) return;
  const active = getActiveGroupCode();
  const name = getActiveGroupName();
  if (active) {
    badge.style.display = 'inline-flex';
    badge.querySelector('.btn-text').textContent = name;
  } else {
    badge.style.display = 'none';
  }
}
