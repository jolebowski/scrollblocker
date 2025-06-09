let scrollStart = Date.now()
let totalTime = 0
let timer
let hasBlocked = false
let scrollLimit = 60000 // fallback
let isScrolling = false
let currentSite = window.location.hostname

console.log(`ScrollBlocker: Script chargé sur ${currentSite}`)

// Vérifier si ce site doit être bloqué
function checkIfSiteIsBlocked() {
  console.log(`ScrollBlocker: Vérification du domaine: ${currentSite}`)

  // Vérifier que l'API Chrome est disponible
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error('ScrollBlocker: API Chrome storage non disponible')
    return
  }

  chrome.storage.local.get(['blockedSites'], (data) => {
    // Vérifier les erreurs de runtime
    if (chrome.runtime.lastError) {
      console.error('ScrollBlocker: Erreur de storage:', chrome.runtime.lastError)
      return
    }

    let blockedSites = data.blockedSites || []
    console.log(`ScrollBlocker: Sites bloqués (format brut):`, blockedSites)

    // Gérer les deux formats : array (ancien) et object (nouveau)
    let siteLimit = null
    let isBlocked = false

    if (Array.isArray(blockedSites)) {
      // Ancien format : array simple
      console.log(`ScrollBlocker: Utilisation de l'ancien format (array)`)
      isBlocked = blockedSites.some((site) => {
        const isMatch = currentSite === site || currentSite.endsWith('.' + site)
        if (isMatch) {
          console.log(`ScrollBlocker: Match trouvé! ${currentSite} correspond à ${site}`)
          siteLimit = null // Utilisera la limite globale
        }
        return isMatch
      })
    } else {
      // Nouveau format : object avec limites individuelles
      console.log(`ScrollBlocker: Utilisation du nouveau format (object)`)
      for (const [site, limitMs] of Object.entries(blockedSites)) {
        const isMatch = currentSite === site || currentSite.endsWith('.' + site)
        if (isMatch) {
          isBlocked = true
          siteLimit = limitMs
          console.log(
            `ScrollBlocker: Match trouvé! ${currentSite} correspond à ${site} avec limite ${limitMs}ms`,
          )
          break
        }
      }
    }

    console.log(`ScrollBlocker: Site bloqué? ${isBlocked}, Limite spécifique: ${siteLimit}`)

    if (isBlocked) {
      if (siteLimit) {
        scrollLimit = parseInt(siteLimit)
        console.log(`ScrollBlocker: Utilisation de la limite spécifique: ${scrollLimit}ms`)
      }
      console.log(`ScrollBlocker: Initialisation du blocage pour ${currentSite}`)
      initializeScrollBlocker()
    } else {
      console.log(`ScrollBlocker: Pas de blocage pour ${currentSite}`)
      // Si le site n'est plus dans la liste mais était bloqué, le débloquer
      const blockedKey = `scrollBlocked_${currentSite}`
      chrome.storage.local.get([blockedKey], (data) => {
        if (data[blockedKey] === true) {
          console.log(
            `ScrollBlocker: Site ${currentSite} supprimé de la liste - nettoyage du blocage`,
          )
          chrome.storage.local.remove([blockedKey, `scrollTime_${currentSite}`])
          if (document.body.innerHTML.includes('🚫')) {
            console.log(`ScrollBlocker: Rechargement automatique de la page`)
            window.location.reload()
          }
        }
      })
    }
  })
}

function initializeScrollBlocker() {
  const blockedKey = `scrollBlocked_${currentSite}`

  // Vérifier périodiquement si le blocage a été levé
  const checkBlockedStatus = () => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return
    }

    chrome.storage.local.get([blockedKey], (data) => {
      if (chrome.runtime.lastError) {
        console.error('ScrollBlocker: Erreur de storage:', chrome.runtime.lastError)
        return
      }

      // Si la clé est explicitement mise à false
      if (data[blockedKey] === false && hasBlocked) {
        console.log(
          `ScrollBlocker: Blocage levé pour ${currentSite} - ${blockedKey} = false détecté`,
        )
        hasBlocked = false
        // Recharger automatiquement la page pour sortir de l'écran de blocage
        if (document.body.innerHTML.includes('🚫')) {
          console.log(`ScrollBlocker: Rechargement automatique de la page`)
          window.location.reload()
        }
      }
    })
  }

  // Vérifier toutes les 2 secondes si le blocage a été levé
  setInterval(checkBlockedStatus, 2000)

  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error("ScrollBlocker: API Chrome storage non disponible pour l'initialisation")
    return
  }

  chrome.storage.local.get([blockedKey], (data) => {
    if (chrome.runtime.lastError) {
      console.error('ScrollBlocker: Erreur de storage:', chrome.runtime.lastError)
      return
    }

    if (data[blockedKey] === true) {
      console.log(`ScrollBlocker: Site ${currentSite} déjà bloqué`)
      bloquerPage()
      return
    }

    console.log(`ScrollBlocker: Activation du listener de scroll (limite finale: ${scrollLimit}ms)`)
    window.addEventListener('scroll', onScrollStart)
  })
}

function onScrollStart() {
  // Si on n'était pas en train de scroller, on commence une nouvelle session
  if (!isScrolling) {
    isScrolling = true
    scrollStart = Date.now()
    console.log(`ScrollBlocker: Début de session de scroll sur ${currentSite}`)
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
      `ScrollBlocker: Fin de session sur ${currentSite}. Durée: ${sessionTime}ms. Total: ${totalTime}ms / Limite: ${scrollLimit}ms`,
    )

    if (totalTime >= scrollLimit && !hasBlocked) {
      hasBlocked = true
      console.log(`ScrollBlocker: Limite atteinte pour ${currentSite}!`)

      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error(
          'ScrollBlocker: API Chrome storage non disponible pour sauvegarder le blocage',
        )
        // Continuer quand même avec le blocage visuel
        alert(`Tu as scrollé trop longtemps sur ${currentSite}. Fais une pause !`)
        bloquerPage()
        return
      }

      const blockedKey = `scrollBlocked_${currentSite}`
      chrome.storage.local.set({ [blockedKey]: true }, () => {
        if (chrome.runtime.lastError) {
          console.error('ScrollBlocker: Erreur lors de la sauvegarde:', chrome.runtime.lastError)
        }
      })
      alert(`Tu as scrollé trop longtemps sur ${currentSite}. Fais une pause !`)
      bloquerPage()
    }
  }
}

function bloquerPage() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:20%; font-size: 24px;">
      <p>🚫 <strong>Temps écoulé sur ${currentSite}.</strong></p>
      <p><strong>Reviens plus tard.</strong></p>
    </div>
  `
}

// Initialiser
checkIfSiteIsBlocked()

// Revérifier périodiquement si le site est toujours dans la liste
