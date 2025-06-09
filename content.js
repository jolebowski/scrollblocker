let scrollStart = Date.now()
let totalTime = 0
let timer
let hasBlocked = false
let scrollLimit = 60000 // fallback
let isScrolling = false

console.log(`ScrollBlocker: Script chargé sur ${window.location.hostname}`)

// Vérifier si ce site doit être bloqué
function checkIfSiteIsBlocked() {
  const currentDomain = window.location.hostname
  console.log(`ScrollBlocker: Vérification du domaine: ${currentDomain}`)

  chrome.storage.local.get(['blockedSites'], (data) => {
    // ATTENTION: Pas de sites par défaut - liste vide au début
    const blockedSites = data.blockedSites || []
    console.log(`ScrollBlocker: Sites bloqués:`, blockedSites)

    // Vérifier si le domaine actuel correspond à un site de la liste
    const isBlocked = blockedSites.some((site) => {
      const isMatch = currentDomain === site || currentDomain.endsWith('.' + site)
      if (isMatch) {
        console.log(`ScrollBlocker: Match trouvé! ${currentDomain} correspond à ${site}`)
      }
      return isMatch
    })

    console.log(`ScrollBlocker: Site bloqué? ${isBlocked}`)

    if (isBlocked) {
      console.log(`ScrollBlocker: Initialisation du blocage pour ${currentDomain}`)
      initializeScrollBlocker()
    } else {
      console.log(`ScrollBlocker: Pas de blocage pour ${currentDomain}`)
    }
  })
}

function initializeScrollBlocker() {
  chrome.storage.local.get(['scrollTimeLimit', 'scrollBlocked'], (data) => {
    if (data.scrollBlocked === true) {
      console.log(`ScrollBlocker: Site déjà bloqué`)
      bloquerPage()
      return
    }

    if (data.scrollTimeLimit) {
      scrollLimit = parseInt(data.scrollTimeLimit)
      console.log(`ScrollBlocker: Limit: ${scrollLimit}ms`)
    }

    console.log(`ScrollBlocker: Activation du listener de scroll`)
    window.addEventListener('scroll', onScrollStart)
  })
}

function onScrollStart() {
  // Si on n'était pas en train de scroller, on commence une nouvelle session
  if (!isScrolling) {
    isScrolling = true
    scrollStart = Date.now()
    console.log(`ScrollBlocker: Début de session de scroll`)
  }

  // Réinitialiser le timer à chaque scroll
  clearTimeout(timer)

  // Programmer l'arrêt du scroll après 1 seconde d'inactivité
  timer = setTimeout(() => {
    onScrollEnd()
  }, 1000)
}

function onScrollEnd() {
  if (isScrolling) {
    const now = Date.now()
    const sessionTime = now - scrollStart
    totalTime += sessionTime
    isScrolling = false

    console.log(
      `ScrollBlocker: Fin de session. Durée: ${sessionTime}ms. Total: ${totalTime}ms / Limite: ${scrollLimit}ms`,
    )

    if (totalTime >= scrollLimit && !hasBlocked) {
      hasBlocked = true
      console.log(`ScrollBlocker: Limite atteinte!`)
      chrome.storage.local.set({ scrollBlocked: true })
      alert('Tu as scrollé trop longtemps. Fais une pause !')
      bloquerPage()
    }
  }
}

function bloquerPage() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:20%; font-size: 24px;">
      <p>🚫 <strong>Temps écoulé. Reviens plus tard.</strong></p>
    </div>
  `
}

// Initialiser
checkIfSiteIsBlocked()
