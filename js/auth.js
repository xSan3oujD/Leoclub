import { auth as fbAuth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

const isFirstUser = async () => {
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        return usersSnap.empty;
    } catch (error) {
        if (error?.code === 'permission-denied') {
            return true;
        }
        throw error;
    }
};

export const auth = {
    login: async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(fbAuth, email, password);
            const fbUser = userCredential.user;

            // Fetch extra data from Firestore
            const userDoc = await getDoc(doc(db, "users", fbUser.email.toLowerCase()));
            let userData;

            const isMasterAdmin = fbUser.email.toLowerCase() === 'leoadmin@gmail.com';

            if (userDoc.exists()) {
                userData = userDoc.data();
                if (isMasterAdmin && userData.role !== 'Admin') {
                    userData.role = 'Admin';
                    await updateDoc(doc(db, "users", fbUser.email.toLowerCase()), { role: 'Admin', lastSeen: new Date().toISOString() });
                } else {
                    // Update last seen
                    await updateDoc(doc(db, "users", fbUser.email.toLowerCase()), { lastSeen: new Date().toISOString() });
                }
                // Refresh userData to include lastSeen
                userData.lastSeen = new Date().toISOString();
            } else {
                userData = {
                    name: email.split('@')[0],
                    email: fbUser.email.toLowerCase(),
                    role: 'Admin', // Master email gets Admin
                    avatar: email.substring(0, 2).toUpperCase(),
                    status: 'active',
                    permissions: {}
                };
                await setDoc(doc(db, "users", fbUser.email.toLowerCase()), userData);
            }

            localStorage.setItem('leo_current_user', JSON.stringify(userData));

            // Sync saved accounts for switcher
            let saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
            const idx = saved.findIndex(a => a.email === userData.email);
            if (idx === -1) {
                saved.push(userData);
            } else {
                saved[idx] = userData; // Update in case role/info changed
            }
            localStorage.setItem('leo_saved_accounts', JSON.stringify(saved));

            return { success: true, user: userData };
        } catch (error) {
            console.error("Login Error:", error.code, error.message);
            let msg = "Login failed. Please check your credentials.";
            if (error.code === 'auth/user-not-found') msg = "User not found. Please Sign Up first.";
            if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
            if (error.code === 'auth/invalid-email') msg = "Invalid email format.";
            if (error.code === 'auth/network-request-failed') msg = "Network error. Check your connection.";
            if (error.code === 'auth/operation-not-allowed') msg = "Email/Password login is not enabled in Firebase Console.";

            return { success: false, message: msg };
        }
    },

    loginWithGoogle: async () => {
        try {
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(fbAuth, provider);
            const fbUser = userCredential.user;

            // Fetch extra data from Firestore
            const userDoc = await getDoc(doc(db, "users", fbUser.email.toLowerCase()));
            let userData;

            const isMasterAdmin = fbUser.email.toLowerCase() === 'leoadmin@gmail.com';

            if (userDoc.exists()) {
                userData = userDoc.data();
                if (isMasterAdmin && userData.role !== 'Admin') {
                    userData.role = 'Admin';
                    await updateDoc(doc(db, "users", fbUser.email.toLowerCase()), { role: 'Admin', lastSeen: new Date().toISOString() });
                } else {
                    // Update last seen
                    await updateDoc(doc(db, "users", fbUser.email.toLowerCase()), { lastSeen: new Date().toISOString() });
                }
                userData.lastSeen = new Date().toISOString();
            } else {
                // Check if this is the first user ever (Bootstrap Admin)
                const isBootstrapUser = await isFirstUser();

                userData = {
                    id: Date.now(),
                    name: fbUser.displayName || fbUser.email.split('@')[0],
                    email: fbUser.email.toLowerCase(),
                    role: (isMasterAdmin || isBootstrapUser) ? 'Admin' : 'Volunteer',
                    avatar: fbUser.photoURL || (fbUser.displayName || fbUser.email).substring(0, 2).toUpperCase(),
                    profilePicture: fbUser.photoURL || null,
                    status: 'active',
                    permissions: {},
                    lastSeen: new Date().toISOString()
                };
                await setDoc(doc(db, "users", fbUser.email.toLowerCase()), userData);
            }

            localStorage.setItem('leo_current_user', JSON.stringify(userData));

            // Sync saved accounts for switcher
            let saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
            const idx = saved.findIndex(a => a.email === userData.email);
            if (idx === -1) {
                saved.push(userData);
            } else {
                saved[idx] = userData; // Update in case role/info changed
            }
            localStorage.setItem('leo_saved_accounts', JSON.stringify(saved));

            return { success: true, user: userData };
        } catch (error) {
            console.error("Google Login Error:", error.code, error.message);
            let msg = error.message || "Google Login failed.";
            if (error.code === 'auth/popup-closed-by-user') msg = "Login popup was closed.";
            if (error.code === 'auth/cancelled-by-user') msg = "Login was cancelled.";
            if (error.code === 'auth/network-request-failed') msg = "Network error. Check your connection.";
            if (error.code === 'auth/operation-not-allowed') msg = "Google Sign-In is not enabled in Firebase Console.";
            if (error.code === 'auth/unauthorized-domain') msg = "This domain is not authorized for Google Sign-In.";

            return { success: false, message: msg };
        }
    },

    register: async (name, email, password, switchSession = true, mobile = '') => {
        try {
            // Check if this is the first user ever (Bootstrap Admin)
            const isBootstrapUser = await isFirstUser();

            const userCredential = await createUserWithEmailAndPassword(fbAuth, email, password);
            const fbUser = userCredential.user;

            const userData = {
                id: Date.now(),
                name,
                email: email.toLowerCase(),
                mobile: mobile || '',
                role: isBootstrapUser ? 'Admin' : 'Volunteer',
                status: 'active',
                avatar: name.substring(0, 2).toUpperCase(),
                permissions: {},
                lastSeen: new Date().toISOString()
            };

            // Save to Firestore
            await setDoc(doc(db, "users", email.toLowerCase()), userData);

            // Sync with saved accounts
            let saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
            if (!saved.find(a => a.email === userData.email)) {
                saved.push(userData);
                localStorage.setItem('leo_saved_accounts', JSON.stringify(saved));
            }

            if (switchSession) {
                localStorage.setItem('leo_current_user', JSON.stringify(userData));
            }
            return { success: true, user: userData };
        } catch (error) {
            console.error("Register Error:", error.code, error.message);
            let msg = error.message || "Sign-up failed.";
            if (error.code === 'permission-denied') {
                msg = "Firestore permission denied. Update your Firebase security rules to allow authenticated users to write to the users collection.";
            }
            if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
            if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
            if (error.code === 'auth/invalid-email') msg = "Invalid email format.";
            if (error.code === 'auth/network-request-failed') msg = "Network error. Check your connection.";
            return { success: false, message: msg };
        }
    },

    updateUser: async (email, updates) => {
        try {
            const userRef = doc(db, "users", email.toLowerCase());
            await updateDoc(userRef, updates);
            return true;
        } catch (error) {
            console.error("Update User Error:", error);
            return false;
        }
    },

    deleteUser: async (email) => {
        try {
            const userRef = doc(db, "users", email.toLowerCase());
            await deleteDoc(userRef);

            let saved = JSON.parse(localStorage.getItem('leo_saved_accounts')) || [];
            saved = saved.filter(a => a.email !== email);
            localStorage.setItem('leo_saved_accounts', JSON.stringify(saved));
            return true;
        } catch (error) {
            return false;
        }
    },

    logout: () => {
        signOut(fbAuth);
        localStorage.removeItem('leo_current_user');
        window.location.href = 'login.html';
    },

    getCurrentUser: () => {
        return JSON.parse(localStorage.getItem('leo_current_user'));
    },

    checkAuth: () => {
        let user = JSON.parse(localStorage.getItem('leo_current_user'));
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }

        // Failsafe: Always ensure master email is Admin
        if (user.email.toLowerCase() === 'leoadmin@gmail.com' && user.role !== 'Admin') {
            user.role = 'Admin';
            localStorage.setItem('leo_current_user', JSON.stringify(user));
        }

        return user;
    }
};
