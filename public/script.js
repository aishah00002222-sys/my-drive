
// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = 'https://delzycjununidldcaasl.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_72Q7nYNwivbANMROncb1BQ_PITahXFC';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ==========================================
// 2. GLOBAL VARIABLES AND HTML ELEMENTS
// ==========================================

let currentFolderId = null;

const backButton = document.getElementById('backButton');

const googleLoginButton = document.getElementById('googleLoginButton');
const authSection = document.getElementById('authSection');
const driveApp = document.getElementById('driveApp');

const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');

const authMessage = document.getElementById('authMessage');
const logoutButton = document.getElementById('logoutButton');

const itemsList = document.getElementById('itemsList');

const createFolderButton =
    document.getElementById('createFolderButton');

const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');

const searchInput = document.getElementById('searchInput');


// ==========================================
// 3. GENERAL FUNCTIONS
// ==========================================

function showDrive(isLoggedIn) {
    authSection.hidden = isLoggedIn;
    driveApp.hidden = !isLoggedIn;
}

async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) throw error;

    if (!data.user) {
        throw new Error('Please log in first.');
    }

    return data.user;
}

function setActiveButton(buttonId) {
    document.querySelectorAll('aside button').forEach(button => {
        button.classList.remove('active');
    });

    const button = document.getElementById(buttonId);

    if (button) {
        button.classList.add('active');
    }
}

function showEmptyMessage(message) {
    itemsList.innerHTML = '';
    itemsList.textContent = message;
}

async function openFile(item) {
    const { data, error } = await supabaseClient
        .storage
        .from('drive-files')
        .createSignedUrl(item.storage_path, 60);

    if (error) {
        alert('Cannot open file: ' + error.message);
        return;
    }

    window.open(data.signedUrl, '_blank');
}


// ==========================================
// 4. AUTHENTICATION
// ==========================================

// Sign Up

signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    authMessage.textContent = 'Creating account...';

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
    });

    if (error) {
        authMessage.textContent = error.message;
        return;
    }

    if (data.session) {
        authMessage.textContent = 'Account created successfully!';

        showDrive(true);

        await loadItems();
    } else {
        authMessage.textContent =
            'Account created! Please check your email to confirm your account.';
    }
});


// Login

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    authMessage.textContent = 'Logging in...';

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        authMessage.textContent = error.message;
        return;
    }

    authMessage.textContent = 'Login successful!';

    showDrive(true);

    currentFolderId = null;

    await loadItems();
});


// Google Login

googleLoginButton.addEventListener('click', async () => {

    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) {
        authMessage.textContent = error.message;
    }
});


// Logout

logoutButton.addEventListener('click', async () => {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        authMessage.textContent = error.message;
        return;
    }

    currentFolderId = null;

    showDrive(false);

    authMessage.textContent = 'You have logged out.';
});


// Check existing session

async function checkSession() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        authMessage.textContent = error.message;
        showDrive(false);
        return;
    }

    showDrive(!!data.session);

    if (data.session) {
        await loadItems();
    }
}


// ==========================================
// 5. MY DRIVE - LOAD FILES AND FOLDERS
// ==========================================

async function loadItems(searchTerm = '') {

    backButton.hidden = currentFolderId === null;

    itemsList.textContent = 'Loading...';

    try {

        const user = await getCurrentUser();

        let query = supabaseClient
            .from('drive_items')
            .select('id, name, item_type, created_at, storage_path, parent_id, owner_id')
            .eq('owner_id', user.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (searchTerm.trim() !== '') {

            query = query.ilike(
                'name',
                `%${searchTerm.trim()}%`
            );

        } else if (currentFolderId === null) {

            query = query.is('parent_id', null);

        } else {

            query = query.eq('parent_id', currentFolderId);
        }

        const { data, error } = await query;

        if (error) throw error;

        itemsList.innerHTML = '';

        if (data.length === 0) {
            showEmptyMessage('This folder is empty.');
            return;
        }

        data.forEach(item => {

            const element = document.createElement('div');

            element.style.cursor = 'pointer';

            // Folder

            if (item.item_type === 'folder') {

                element.textContent = '📁 ' + item.name + ' ';

                element.addEventListener('click', async () => {

                    currentFolderId = item.id;

                    await loadItems();
                });

            }

            // File

            else {

                element.textContent = '📄 ' + item.name + ' ';

                element.addEventListener('click', async () => {
                    await openFile(item);
                });
            }


            // Move to Trash button

            const deleteButton = document.createElement('button');

            deleteButton.textContent = 'Delete';

            deleteButton.addEventListener('click', async (event) => {

                event.stopPropagation();

                if (!confirm(
                    'Move this item to Trash?'
                )) return;

                try {

                    if (item.item_type === 'folder') {

                        await setFolderDeletedRecursively(
                            item.id,
                            true
                        );

                    } else {

                        const { error } = await supabaseClient
                            .from('drive_items')
                            .update({
                                is_deleted: true,
                                deleted_at: new Date().toISOString()
                            })
                            .eq('id', item.id);

                        if (error) throw error;
                    }

                    alert('Moved to Trash successfully!');

                    await loadItems();

                } catch (error) {

                    alert('Delete failed: ' + error.message);
                }
            });

            element.appendChild(deleteButton);


            // Share button - files only

            if (item.item_type === 'file') {

                const shareButton = document.createElement('button');

                shareButton.textContent = 'Share';

                shareButton.addEventListener('click', async (event) => {

                    event.stopPropagation();

                    const email = prompt(
                        'Enter the email of the person you want to share with:'
                    );

                    if (!email || !email.trim()) return;

                    try {

                        const user = await getCurrentUser();

                        const targetEmail = email.trim().toLowerCase();

                        if (targetEmail === user.email.toLowerCase()) {
                            alert('You cannot share a file with yourself.');
                            return;
                        }

                        const { error } = await supabaseClient
                            .from('drive_shares')
                            .insert({
                                item_id: item.id,
                                owner_id: user.id,
                                shared_with_email: targetEmail,
                                permission: 'viewer'
                            });

                        if (error) throw error;

                        alert('File shared successfully!');

                    } catch (error) {

                        alert('Sharing failed: ' + error.message);
                    }
                });

                element.appendChild(shareButton);
            }


            // Rename button

            const renameButton = document.createElement('button');

            renameButton.textContent = 'Rename';

            renameButton.addEventListener('click', async (event) => {

                event.stopPropagation();

                const newName = prompt(
                    'Enter the new name:',
                    item.name
                );

                if (!newName || !newName.trim()) return;

                const { error } = await supabaseClient
                    .from('drive_items')
                    .update({
                        name: newName.trim(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                if (error) {
                    alert('Rename failed: ' + error.message);
                    return;
                }

                await loadItems();
            });

            element.appendChild(renameButton);

            itemsList.appendChild(element);
        });

    } catch (error) {

        showEmptyMessage(error.message);
    }
}


// ==========================================
// 6. FOLDER DELETE AND RESTORE RECURSIVELY
// ==========================================

async function setFolderDeletedRecursively(folderId, isDeleted) {

    const user = await getCurrentUser();

    const { data: children, error } = await supabaseClient
        .from('drive_items')
        .select('id, item_type')
        .eq('parent_id', folderId)
        .eq('owner_id', user.id);

    if (error) throw error;

    for (const item of children) {

        if (item.item_type === 'folder') {

            await setFolderDeletedRecursively(
                item.id,
                isDeleted
            );

        } else {

            const { error } = await supabaseClient
                .from('drive_items')
                .update({
                    is_deleted: isDeleted,
                    deleted_at: isDeleted
                        ? new Date().toISOString()
                        : null
                })
                .eq('id', item.id);

            if (error) throw error;
        }
    }

    const { error: folderError } = await supabaseClient
        .from('drive_items')
        .update({
            is_deleted: isDeleted,
            deleted_at: isDeleted
                ? new Date().toISOString()
                : null
        })
        .eq('id', folderId);

    if (folderError) throw folderError;
}


// ==========================================
// 7. RECENT FILES
// ==========================================

async function loadRecentItems() {

    backButton.hidden = true;

    itemsList.textContent = 'Loading recent files...';

    try {

        const user = await getCurrentUser();

        const { data, error } = await supabaseClient
            .from('drive_items')
            .select('id, name, item_type, created_at, storage_path')
            .eq('owner_id', user.id)
            .eq('item_type', 'file')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        itemsList.innerHTML = '';

        if (data.length === 0) {
            showEmptyMessage('No recent files found.');
            return;
        }

        data.forEach(item => {

            const element = document.createElement('div');

            element.textContent = '📄 ' + item.name;

            element.style.cursor = 'pointer';

            element.addEventListener('click', async () => {
                await openFile(item);
            });

            itemsList.appendChild(element);
        });

    } catch (error) {

        showEmptyMessage(error.message);
    }
}


// ==========================================
// 8. SHARED WITH ME
// ==========================================

async function loadSharedItems() {

    backButton.hidden = true;

    itemsList.textContent = 'Loading shared files...';

    try {

        const user = await getCurrentUser();

        const { data, error } = await supabaseClient
            .from('drive_shares')
            .select(`
                item_id,
                drive_items!inner (
                    id,
                    name,
                    item_type,
                    storage_path,
                    is_deleted
                )
            `)
            .ilike('shared_with_email', user.email);

        if (error) throw error;

        itemsList.innerHTML = '';

        const sharedItems = data.filter(share =>
            share.drive_items &&
            share.drive_items.item_type === 'file' &&
            !share.drive_items.is_deleted
        );

        if (sharedItems.length === 0) {

            showEmptyMessage('No files shared with you yet.');

            return;
        }

        sharedItems.forEach(share => {

            const item = share.drive_items;

            const element = document.createElement('div');

            element.textContent = '📄 ' + item.name;

            element.style.cursor = 'pointer';

            element.addEventListener('click', async () => {
                await openFile(item);
            });

            itemsList.appendChild(element);
        });

    } catch (error) {

        showEmptyMessage(error.message);
    }
}


// ==========================================
// 9. TRASH - SHOW DELETED ITEMS
// ==========================================

async function loadTrash() {

    backButton.hidden = true;

    itemsList.textContent = 'Loading Trash...';

    try {

        const user = await getCurrentUser();

        const { data, error } = await supabaseClient
            .from('drive_items')
            .select('id, name, item_type, parent_id, storage_path, created_at')
            .eq('owner_id', user.id)
            .eq('is_deleted', true)
            .order('deleted_at', { ascending: false });

        if (error) throw error;

        itemsList.innerHTML = '';

        if (data.length === 0) {

            showEmptyMessage('Trash is empty.');

            return;
        }

        // Avoid showing the children of deleted folders separately

        const deletedIds = new Set(
            data.map(item => item.id)
        );

        const topLevelDeletedItems = data.filter(item =>
            !item.parent_id || !deletedIds.has(item.parent_id)
        );

        topLevelDeletedItems.forEach(item => {

            const element = document.createElement('div');

            element.textContent =
                (item.item_type === 'folder' ? '📁 ' : '📄 ') +
                item.name + ' ';


            // Restore button

            const restoreButton = document.createElement('button');

            restoreButton.textContent = 'Restore';

            restoreButton.addEventListener('click', async () => {

                try {

                    if (item.item_type === 'folder') {

                        await setFolderDeletedRecursively(
                            item.id,
                            false
                        );

                    } else {

                        const { error } = await supabaseClient
                            .from('drive_items')
                            .update({
                                is_deleted: false,
                                deleted_at: null
                            })
                            .eq('id', item.id);

                        if (error) throw error;
                    }

                    alert('Item restored successfully!');

                    await loadTrash();

                } catch (error) {

                    alert('Restore failed: ' + error.message);
                }
            });

            element.appendChild(restoreButton);


            // Permanent Delete button

            const permanentDeleteButton =
                document.createElement('button');

            permanentDeleteButton.textContent = 'Delete Forever';

            permanentDeleteButton.addEventListener('click', async () => {

                if (!confirm(
                    'Permanently delete this item and its contents? This cannot be undone.'
                )) return;

                try {

                    await permanentlyDeleteRecursively(item.id);

                    alert('Item permanently deleted!');

                    await loadTrash();

                } catch (error) {

                    alert('Permanent deletion failed: ' + error.message);
                }
            });

            element.appendChild(permanentDeleteButton);

            itemsList.appendChild(element);
        });

    } catch (error) {

        showEmptyMessage(error.message);
    }
}


// ==========================================
// 10. PERMANENT DELETE
// ==========================================

async function permanentlyDeleteRecursively(itemId) {

    const user = await getCurrentUser();

    const { data: item, error: itemError } = await supabaseClient
        .from('drive_items')
        .select('id, item_type, storage_path')
        .eq('id', itemId)
        .eq('owner_id', user.id)
        .single();

    if (itemError) throw itemError;

    if (item.item_type === 'folder') {

        const { data: children, error } = await supabaseClient
            .from('drive_items')
            .select('id')
            .eq('parent_id', itemId)
            .eq('owner_id', user.id);

        if (error) throw error;

        for (const child of children) {

            await permanentlyDeleteRecursively(child.id);
        }

    } else if (item.storage_path) {

        const { error: storageError } = await supabaseClient
            .storage
            .from('drive-files')
            .remove([item.storage_path]);

        if (storageError) throw storageError;
    }

    const { error: deleteError } = await supabaseClient
        .from('drive_items')
        .delete()
        .eq('id', itemId)
        .eq('owner_id', user.id);

    if (deleteError) throw deleteError;
}


// ==========================================
// 11. CREATE FOLDER
// ==========================================

createFolderButton.addEventListener('click', async () => {

    const folderName = prompt('Enter folder name:');

    if (!folderName || !folderName.trim()) return;

    try {

        const user = await getCurrentUser();

        const { error } = await supabaseClient
            .from('drive_items')
            .insert({
                name: folderName.trim(),
                item_type: 'folder',
                owner_id: user.id,
                parent_id: currentFolderId
            });

        if (error) throw error;

        alert('Folder created successfully!');

        await loadItems();

    } catch (error) {

        alert('Error: ' + error.message);
    }
});


// ==========================================
// 12. UPLOAD FILES
// ==========================================

uploadButton.addEventListener('click', async () => {

    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file first.');
        return;
    }

    uploadButton.disabled = true;

    uploadButton.textContent = 'Uploading...';

    try {

        const user = await getCurrentUser();

        const userId = user.id;

        const filePath =
            `${userId}/${currentFolderId || 'root'}/${Date.now()}_${file.name}`;

        // Upload to Storage

        const { error: uploadError } = await supabaseClient
            .storage
            .from('drive-files')
            .upload(filePath, file);

        if (uploadError) throw uploadError;


        // Save file information in database

        const { error: insertError } = await supabaseClient
            .from('drive_items')
            .insert({
                name: file.name,
                item_type: 'file',
                owner_id: userId,
                parent_id: currentFolderId,
                storage_path: filePath,
                mime_type: file.type,
                size_bytes: file.size
            });

        if (insertError) {

            await supabaseClient
                .storage
                .from('drive-files')
                .remove([filePath]);

            throw insertError;
        }

        alert('File uploaded successfully!');

        fileInput.value = '';

        await loadItems();

    } catch (error) {

        alert('Upload failed: ' + error.message);

    } finally {

        uploadButton.disabled = false;

        uploadButton.textContent = 'Upload File';
    }
});


// ==========================================
// 13. SEARCH
// ==========================================

searchInput.addEventListener('input', async () => {

    currentFolderId = null;

    await loadItems(searchInput.value);
});


// ==========================================
// 14. SIDEBAR NAVIGATION
// ==========================================

// My Drive

document.getElementById('myDriveButton')
    .addEventListener('click', async () => {

        currentFolderId = null;

        searchInput.value = '';

        setActiveButton('myDriveButton');

        await loadItems();
    });


// Recent

document.getElementById('recentButton')
    .addEventListener('click', async () => {

        setActiveButton('recentButton');

        await loadRecentItems();
    });


// Shared with me

document.getElementById('sharedButton')
    .addEventListener('click', async () => {

        setActiveButton('sharedButton');

        await loadSharedItems();
    });


// Trash

document.getElementById('trashButton')
    .addEventListener('click', async () => {

        setActiveButton('trashButton');

        await loadTrash();
    });


// Back button

backButton.addEventListener('click', async () => {

    currentFolderId = null;

    await loadItems();
});


// ==========================================
// 15. START APPLICATION
// ==========================================

checkSession();
