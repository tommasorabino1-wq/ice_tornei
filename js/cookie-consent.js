// ===============================
// COOKIE CONSENT SYSTEM
// ===============================

document.addEventListener("DOMContentLoaded", function(){

  const banner = document.getElementById("cookie-banner");
  const acceptBtn = document.getElementById("cookie-accept");
  const rejectBtn = document.getElementById("cookie-reject");

  const consent = localStorage.getItem("cookieConsent");

  // se non esiste consenso → mostra banner
  if(!consent){
    banner.classList.remove("hidden");
  }

  // se consenso già accettato → carica analytics
  if(consent === "accepted"){
    loadAnalytics();
  }

  // ===============================
  // ACCEPT
  // ===============================

  acceptBtn.addEventListener("click", function(){

    localStorage.setItem("cookieConsent","accepted");

    banner.classList.add("hidden");

    loadAnalytics();

  });

  // ===============================
  // REJECT
  // ===============================

  rejectBtn.addEventListener("click", function(){

    localStorage.setItem("cookieConsent","rejected");

    banner.classList.add("hidden");

  });

});


// ===============================
// LOAD ANALYTICS
// ===============================

function loadAnalytics(){

  // -------------------------------
  // GOOGLE ANALYTICS
  // -------------------------------

  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-VGMSGWT50P";
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', 'G-VGMSGWT50P');


  // -------------------------------
  // MICROSOFT CLARITY
  // -------------------------------

  (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "vw7bg1rrix");

}