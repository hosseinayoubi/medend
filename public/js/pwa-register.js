// Medend PWA registration
(function(){
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("/sw.js").catch(function(err){
      // Silent fail (do not break UX)
      console.warn("SW registration failed:", err);
    });
  });
})();
