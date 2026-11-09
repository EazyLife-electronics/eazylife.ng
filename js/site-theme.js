(function(){
  var root=document.documentElement;
  function setTheme(theme,save){
    theme=theme==='dark'?'dark':'light';
    root.setAttribute('data-theme',theme);
    root.classList.toggle('dark',theme==='dark');
    if(save){try{localStorage.setItem('eazylife-theme',theme)}catch(e){}}
    document.querySelectorAll('[data-theme-logo]').forEach(function(img){
      img.src=theme==='dark'?(img.getAttribute('data-theme-logo-dark')||'assets/pictures/logo_white_transparent.png'):(img.getAttribute('data-theme-logo-light')||'assets/pictures/logo_black_transparent.png');
    });
    document.querySelectorAll('.el-theme-toggle i').forEach(function(icon){icon.className=theme==='dark'?'fas fa-sun':'fas fa-moon'});
    document.querySelectorAll('.el-theme-toggle').forEach(function(btn){btn.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');btn.title=theme==='dark'?'Switch to light mode':'Switch to dark mode'});
  }
  var saved=null;try{saved=localStorage.getItem('eazylife-theme')}catch(e){}
  setTheme(saved||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'),false);
  function addToggle(){
    if(document.querySelector('.el-theme-toggle'))return;
    var btn=document.createElement('button');btn.type='button';btn.className='el-theme-toggle';btn.innerHTML='<i class="fas fa-moon" aria-hidden="true"></i>';btn.addEventListener('click',function(){setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark',true)});
    var host=document.querySelector('header .nav-inner, header .nav, header .flex.items-center.justify-between, header .max-w-xl > div, header');
    if(host){host.appendChild(btn);if(getComputedStyle(host).display==='flex'){host.style.gap=host.style.gap||'12px';}}
    else{btn.style.position='fixed';btn.style.top='12px';btn.style.right='12px';btn.style.zIndex='10000';document.body.appendChild(btn);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addToggle);else addToggle();
  if(window.matchMedia){var mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',function(e){var has=false;try{has=!!localStorage.getItem('eazylife-theme')}catch(_){}if(!has)setTheme(e.matches?'dark':'light',false)});}
})();