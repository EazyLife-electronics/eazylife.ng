// admin/js/admin-app.mjs
// Orchestrates the admin dashboard: handles login/logout and, once
// authenticated, subscribes to each Firestore collection and hands the data
// to the matching section module. Each tab's own form handling, rendering,
// and DOM wiring lives in its own file (admin-products.mjs, admin-heroes.mjs,
// etc.) — this file just wires them together.
import { initFirebase } from '../../js/firebase.mjs';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup, EmailAuthProvider, linkWithCredential, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  watchProducts, watchHeroes, watchReviews, watchRequests, watchOrders, watchProjects
} from '../../js/store.mjs';

import { initTabs, initImagePicker } from './admin-shared.mjs';
import { initProducts, renderProducts } from './admin-products.mjs';
import { initHeroes, renderHeroes, setProductsForHeroLinks } from './admin-heroes.mjs';
import { initReviews, renderReviews } from './admin-reviews.mjs';
import { renderRequestList } from './admin-requests.mjs';
import { renderOrderList } from './admin-orders.mjs';
import { initProjects, renderProjects, checkDueProjectPublications, setProjectKitProducts } from './admin-projects.mjs';
import { initSettings, loadSettingsForm } from './admin-settings.mjs';
import { setQuotationProducts } from './admin-quotations.mjs';
import { initSchoolStem, resetSchoolStem } from './admin-school-stem.mjs';
import { initTechnicalTraining, resetTechnicalTraining } from './admin-technical-training.mjs';
import { isAdminUser, verifyAdminAccess, consumeAdminReturnTo, getAdminApprovalDiagnostic } from './admin-auth.mjs?v=auth-refresh-20261126';

const { auth, db } = initFirebase();

const MEDIA_WORKER_URL = 'https://eazylife-media.damzyeazy.workers.dev';

async function checkMediaService(user) {
  const statusEl = document.getElementById('mediaServiceStatus');
  if (!statusEl) return;

  statusEl.textContent = 'Checking media service…';
  statusEl.className = 'text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500';

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${MEDIA_WORKER_URL}/auth`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Admin verification failed' : `Worker returned ${response.status}`);
    }

    const data = await response.json();
    if (!data.token || !data.signature || !data.expire || !data.publicKey) {
      throw new Error('Worker returned incomplete upload credentials');
    }

    const filesResponse = await fetch(`${MEDIA_WORKER_URL}/files?path=${encodeURIComponent('/eazylife/projects')}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!filesResponse.ok) {
      throw new Error(filesResponse.status === 401 ? 'Admin verification failed while listing media' : `Media listing returned ${filesResponse.status}`);
    }
    await filesResponse.json();

    statusEl.textContent = 'Media service connected · library access OK';
    statusEl.className = 'text-[10px] px-2 py-1 rounded-full bg-green-50 text-green-700';
  } catch (error) {
    console.error('EazyLife media service check failed:', error);
    statusEl.textContent = 'Media service unavailable';
    statusEl.className = 'text-[10px] px-2 py-1 rounded-full bg-red-50 text-red-700';
  }
}

initTabs();
initImagePicker();
initProducts();
initHeroes();
initReviews();
initProjects();
initSettings();

let unsubProducts = null;
let unsubHeroes = null;
let unsubReviews = null;
let unsubRequests = null;
let unsubOrders = null;
let unsubProjects = null;
let projectPublishTimer = null;

let currentAdminReviews = [];
let currentAdminRequests = [];
let currentAdminOrders = [];
let upcomingSchoolAppointment = null;

function updateAdminAttention() {
  const pendingOrders = currentAdminOrders.filter(order => String(order.status || 'new').toLowerCase() === 'new').length;
  const pendingRequests = currentAdminRequests.filter(request => String(request.status || 'new').toLowerCase() === 'new').length;
  const pendingReviews = currentAdminReviews.filter(review => review.approved !== true && review.adminReviewed !== true).length;
  const total = pendingOrders + pendingRequests + pendingReviews + (upcomingSchoolAppointment ? 1 : 0);
  const panel = document.getElementById('adminAttentionPanel');
  if (panel) panel.classList.toggle('hidden', total === 0);
  const totalEl = document.getElementById('adminAttentionTotal');
  if (totalEl) totalEl.textContent = String(total);
  const values = {
    orders: pendingOrders,
    requests: pendingRequests,
    reviews: pendingReviews,
    schoolStem: upcomingSchoolAppointment ? 1 : 0
  };
  Object.entries(values).forEach(([key, count]) => {
    const summary = document.getElementById('attention' + key[0].toUpperCase() + key.slice(1) + 'Count');
    const badge = document.getElementById(key + 'NotificationBadge');
    if (summary) summary.textContent = String(count);
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('hidden', count === 0);
    }
  });
}


window.addEventListener('school-stem-appointments-updated', (event) => {
  upcomingSchoolAppointment = event.detail || null;
  const card = document.getElementById('attentionSchoolStem');
  const text = document.getElementById('attentionSchoolStemText');
  if (card) card.classList.toggle('hidden', !upcomingSchoolAppointment);
  if (text && upcomingSchoolAppointment) {
    const d = new Date(upcomingSchoolAppointment.date + 'T' + (upcomingSchoolAppointment.time || '09:00') + ':00');
    const when = d.toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' });
    text.textContent = upcomingSchoolAppointment.schoolName + ' · ' + when + ' · ' + (upcomingSchoolAppointment.purpose || 'School STEM meeting');
  }
  updateAdminAttention();
});

document.querySelectorAll('[data-notification-tab]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelector('[data-tab="' + button.dataset.notificationTab + '"]')?.click();
  });
});

/* ---------------- AUTH ---------------- */
const loginButton=document.getElementById('loginBtn'),errorEl=document.getElementById('loginError'),googleButton=document.getElementById('googleLoginBtn'),registerButton=document.getElementById('registerBtn'),resendButton=document.getElementById('resendVerificationBtn'),passwordSetupButton=document.getElementById('passwordSetupBtn');
// Mark the login handler as installed so the HTML fallback does not show a false module-init warning.
loginButton.dataset.authHandlerReady='yes';
function authMessage(message,bad=false){errorEl.style.color=bad?'#c22':'#087f70';errorEl.textContent=message;errorEl.classList.remove('hidden')}
function setAuthBusy(busy){[loginButton,registerButton,googleButton,passwordSetupButton].filter(Boolean).forEach(b=>b.disabled=busy);loginButton.textContent=busy?'Please wait…':'Log In'}
async function explainAuthFailure(err){const messages={'auth/unauthorized-domain':'This website domain is not authorized in Firebase Authentication settings.','auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'That email already has an account. Sign in instead.','auth/weak-password':'Choose a stronger password (at least 6 characters).','auth/invalid-email':'The email address is not valid.','auth/too-many-requests':'Too many attempts. Wait before trying again.','auth/network-request-failed':'Network request failed. Check your connection.'};authMessage(messages[err.code]||('Authentication failed: '+(err.code||err.message||'Unknown error')),true)}
loginButton.addEventListener('click',async()=>{const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;if(!email||!password)return authMessage('Enter your email and password.',true);setAuthBusy(true);authMessage('Connecting to Firebase…');try{await signInWithEmailAndPassword(auth,email,password);authMessage('Signed in. Checking admin approval…')}catch(err){await explainAuthFailure(err)}finally{setAuthBusy(false)}});
registerButton.addEventListener('click',async()=>{const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;if(!email||!password)return authMessage('Enter an email and password to create your account.',true);setAuthBusy(true);try{const credential=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(credential.user);await signOut(auth);authMessage('Account created. Check your inbox and verify your email, then sign in. Admin access still requires owner approval of your Firebase UID.')}catch(err){await explainAuthFailure(err)}finally{setAuthBusy(false)}});
googleButton.addEventListener('click',async()=>{setAuthBusy(true);try{await signInWithPopup(auth,new GoogleAuthProvider());authMessage('Google sign-in complete. Checking admin approval…')}catch(err){await explainAuthFailure(err)}finally{setAuthBusy(false)}});
passwordSetupButton.dataset.authHandlerReady='yes';passwordSetupButton.addEventListener('click',async()=>{const originalPasswordSetupLabel=passwordSetupButton.textContent;const email=document.getElementById('loginEmail').value.trim().toLowerCase(),password=document.getElementById('loginPassword').value;if(!email||!password)return authMessage('Enter the account email and a new password (at least 6 characters) first.',true);if(password.length<6)return authMessage('Choose a password with at least 6 characters.',true);setAuthBusy(true);passwordSetupButton.textContent='Opening Google verification…';try{authMessage('A Google sign-in window should open. If it does not, allow pop-ups for this site and try again.');const result=await signInWithPopup(auth,new GoogleAuthProvider());const user=result.user;if((user.email||'').toLowerCase()!==email){await signOut(auth);return authMessage('The Google account must match the email entered above. Try again with the approved admin email.',true)}if(!(await verifyAdminAccess(user,db))){await signOut(auth);return authMessage('This Google account is not approved for admin access. No password was linked.',true)}const credential=EmailAuthProvider.credential(email,password);await linkWithCredential(user,credential);authMessage('Email and password linked to your existing approved admin account. You can now log in with either method.')}catch(err){if(err.code==='auth/provider-already-linked')authMessage('Email/password is already linked. Use Log In with your password.',false);else if(err.code==='auth/credential-already-in-use'||err.code==='auth/email-already-in-use')authMessage('That email/password credential belongs to another Firebase account. Nothing was changed; contact the site owner before proceeding.',true);else await explainAuthFailure(err)}finally{setAuthBusy(false);passwordSetupButton.textContent=originalPasswordSetupLabel}});
resendButton.addEventListener('click',async()=>{const user=auth.currentUser;if(!user)return authMessage('Sign in with your email and password first.',true);try{await sendEmailVerification(user);await signOut(auth);authMessage('Verification email sent. Verify it, then sign in again.')}catch(err){await explainAuthFailure(err)}});
document.getElementById('logoutBtn').addEventListener('click',()=>signOut(auth));
document.getElementById('pendingSignOutBtn').addEventListener('click',()=>signOut(auth));
onAuthStateChanged(auth,async user=>{if(user){authMessage('Checking admin approval for your signed-in UID…');const approved=await verifyAdminAccess(user,db);if(!approved){const passwordProvider=(user.providerData||[]).some(p=>p.providerId==='password'),diagnostic=getAdminApprovalDiagnostic(user),detail=passwordProvider&&!user.emailVerified?'Firebase still reports this account email as unverified after refreshing its authentication record.':diagnostic?`Admin approval check failed (${diagnostic}).`:'This account is not approved yet.';const next=diagnostic?.startsWith('auth/email-not-verified')?' Complete email verification for this account, then sign in again. The Firestore approval document does not need changing.':diagnostic?' Check your internet connection and Firebase project/Firestore read access; no account or rules changes are needed unless the error identifies a permissions issue.':' Confirm adminAccess/'+user.uid+' in Firestore has role: admin and status: approved.';authMessage(detail+next,true);resendButton.classList.toggle('hidden',!passwordProvider||user.emailVerified);document.getElementById('pendingSignOutBtn').classList.remove('hidden');return}if(consumeAdminReturnTo(user))return;checkMediaService(user);document.getElementById('loginScreen').classList.add('hidden');document.getElementById('dashboard').classList.remove('hidden');startDashboard();if(projectPublishTimer)clearInterval(projectPublishTimer);projectPublishTimer=setInterval(checkDueProjectPublications,60000)}else{document.getElementById('dashboard').classList.add('hidden');resetSchoolStem();resetTechnicalTraining();document.getElementById('loginScreen').classList.remove('hidden');document.getElementById('pendingSignOutBtn').classList.add('hidden');resendButton.classList.add('hidden');if(unsubProducts)unsubProducts();if(unsubHeroes)unsubHeroes();if(unsubReviews)unsubReviews();if(unsubRequests)unsubRequests();if(unsubOrders)unsubOrders();if(unsubProjects)unsubProjects();if(projectPublishTimer){clearInterval(projectPublishTimer);projectPublishTimer=null}}});
function startDashboard() {
  if (isAdminUser(auth.currentUser)) {
    initSchoolStem();
    initTechnicalTraining();
  } else {
    resetSchoolStem();
    resetTechnicalTraining();
  }
  unsubProducts = watchProducts((products) => {
    renderProducts(products);
    setQuotationProducts(products);
    setProjectKitProducts(products);
    // The hero form's "link to category"/"link to product" dropdowns are
    // built from the product list, so heroes needs to hear about it too.
    setProductsForHeroLinks(products);
  });
  unsubHeroes = watchHeroes(renderHeroes);
  unsubReviews = watchReviews((reviews) => {
    currentAdminReviews = reviews;
    renderReviews(reviews);
    updateAdminAttention();
  });
  unsubRequests = watchRequests((requests) => {
    currentAdminRequests = requests;
    renderRequestList(requests);
    updateAdminAttention();
  });
  unsubOrders = watchOrders((orders) => {
    currentAdminOrders = orders;
    renderOrderList(orders);
    updateAdminAttention();
  });
  unsubProjects = watchProjects(renderProjects);
  loadSettingsForm();
}
