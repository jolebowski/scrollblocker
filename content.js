let scrollStart = Date.now()
let totalTime = 0
let timer
let hasBlocked = false
let scrollLimit = 60000 // fallback par défaut
let isScrolling = false
console.log('🔵 CONTENT - Hostname original:', window.location.hostname)
let currentSite = window.location.hostname.replace(/^www\./, '')
console.log('🔵 CONTENT - Hostname nettoyé:', currentSite)

/**
 * Vérifie si le site actuel doit être bloqué selon la configuration
 * Gère la compatibilité entre ancien format (array) et nouveau format (object)
 * Lance l'initialisation du blocage si le site est dans la liste
 */
function checkIfSiteIsBlocked() {
  // Vérifier que l'API Chrome est disponible
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return
  }

  chrome.storage.local.get(['blockedSites'], (data) => {
    if (chrome.runtime.lastError) {
      return
    }

    let blockedSites = data.blockedSites || []
    let siteLimit = null
    let isBlocked = false

    if (Array.isArray(blockedSites)) {
      // Ancien format : array simple ['site1', 'site2']
      isBlocked = blockedSites.some((site) => {
        const isMatch = currentSite === site || currentSite.endsWith('.' + site)
        if (isMatch) {
          siteLimit = null // Utilisera la limite globale
        }
        return isMatch
      })
    } else {
      // Nouveau format : object {'site1': timeMs, 'site2': timeMs}
      for (const [site, limitMs] of Object.entries(blockedSites)) {
        const isMatch = currentSite === site || currentSite.endsWith('.' + site)
        if (isMatch) {
          isBlocked = true
          siteLimit = limitMs
          break
        }
      }
    }

    if (isBlocked) {
      if (siteLimit) {
        scrollLimit = parseInt(siteLimit)
      }
      initializeScrollBlocker()
    } else {
      // Nettoyer les données si le site a été retiré de la liste
      const blockedKey = `scrollBlocked_${currentSite}`
      chrome.storage.local.get([blockedKey], (data) => {
        if (data[blockedKey] === true) {
          // Mettre la clé à false au lieu de la supprimer pour être cohérent
          chrome.storage.local.set({ [blockedKey]: false }, () => {
            chrome.storage.local.remove([`scrollTime_${currentSite}`])
            if (document.body.innerHTML.includes('🚫')) {
              window.location.reload()
            }
          })
        }
      })
    }
  })
}

/**
 * Initialise le système de blocage pour le site actuel
 * - Configure un vérificateur périodique pour les changements de statut
 * - Active le listener de scroll si le site n'est pas déjà bloqué
 */
function initializeScrollBlocker() {
  const blockedKey = `scrollBlocked_${currentSite}`

  /**
   * Fonction interne qui vérifie périodiquement si le blocage a été levé
   * depuis le popup (clé mise à false) ou si le site a été retiré de la liste
   */
  const checkBlockedStatus = () => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return
    }

    // Vérifier d'abord si le site est encore dans la liste des sites bloqués
    chrome.storage.local.get(['blockedSites'], (data) => {
      if (chrome.runtime.lastError) {
        return
      }

      let blockedSites = data.blockedSites || []
      let isStillInList = false

      if (Array.isArray(blockedSites)) {
        // Ancien format : array simple
        isStillInList = blockedSites.some((site) => {
          return currentSite === site || currentSite.endsWith('.' + site)
        })
      } else {
        // Nouveau format : object
        for (const site of Object.keys(blockedSites)) {
          if (currentSite === site || currentSite.endsWith('.' + site)) {
            isStillInList = true
            break
          }
        }
      }

      // Si le site n'est plus dans la liste et qu'on est sur l'écran de blocage
      if (!isStillInList && document.body.innerHTML.includes('🚫')) {
        // Nettoyer les données et recharger
        chrome.storage.local.remove([blockedKey, `scrollTime_${currentSite}`])
        window.location.reload()
        return
      }

      // Vérifier ensuite le statut de blocage individuel
      chrome.storage.local.get([blockedKey], (data) => {
        if (chrome.runtime.lastError) {
          return
        }

        // Si la clé est explicitement mise à false (déblocage depuis popup)
        if (data[blockedKey] === false && hasBlocked) {
          hasBlocked = false
          // Recharger automatiquement si on est sur l'écran de blocage
          if (document.body.innerHTML.includes('🚫')) {
            window.location.reload()
          }
        }
      })
    })
  }

  // Vérifier toutes les 2 secondes si le blocage a été levé
  setInterval(checkBlockedStatus, 2000)

  if (typeof chrome === 'undefined' || !chrome.storage) {
    return
  }

  chrome.storage.local.get([blockedKey], (data) => {
    if (chrome.runtime.lastError) {
      return
    }

    if (data[blockedKey] === true) {
      // Site déjà bloqué, afficher l'écran de blocage
      bloquerPage()
      return
    }

    // Activer le listener de scroll
    window.addEventListener('scroll', onScrollStart)
  })
}

/**
 * Démarre ou continue une session de scroll
 * Utilise un timer de 1 seconde pour détecter la fin du scroll
 */
function onScrollStart() {
  // Commencer une nouvelle session si on ne scrollait pas déjà
  if (!isScrolling) {
    isScrolling = true
    scrollStart = Date.now()
  }

  // Réinitialiser le timer à chaque mouvement de scroll
  clearTimeout(timer)

  // Programmer l'arrêt du scroll après 1 seconde d'inactivité
  timer = setTimeout(() => {
    onScrollEnd()
  }, 1000)
}

/**
 * Termine une session de scroll et cumule le temps
 * Vérifie si la limite est atteinte et bloque le site si nécessaire
 */
function onScrollEnd() {
  if (isScrolling) {
    const now = Date.now()
    const sessionTime = now - scrollStart
    totalTime += sessionTime
    isScrolling = false

    // Vérifier si la limite est atteinte
    if (totalTime >= scrollLimit && !hasBlocked) {
      hasBlocked = true

      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Continuer avec le blocage visuel même si pas d'API
        alert(`Tu as scrollé trop longtemps sur ${currentSite}. Fais une pause !`)
        bloquerPage()
        return
      }

      // Sauvegarder le statut de blocage
      const blockedKey = `scrollBlocked_${currentSite}`
      console.log(`🔴 CONTENT - Blocage activé pour ${currentSite}, clé: ${blockedKey}`)
      chrome.storage.local.set({ [blockedKey]: true }, () => {
        if (chrome.runtime.lastError) {
          // Erreur silencieuse, le blocage visuel fonctionnera quand même
          console.log(`❌ CONTENT - Erreur sauvegarde:`, chrome.runtime.lastError)
        } else {
          console.log(`✅ CONTENT - Clé ${blockedKey} sauvegardée avec valeur: true`)
        }
      })

      alert(`Tu as scrollé trop longtemps sur ${currentSite}. Fais une pause !`)
      bloquerPage()
    }
  }
}

/**
 * Remplace le contenu de la page par un écran de blocage
 */
function bloquerPage() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:20%; font-size: 24px;">
      <p>🚫 <strong>Temps écoulé sur ${currentSite}.</strong></p>
      <p><strong>Reviens plus tard.</strong></p>
    </div>
  `
}

// Initialiser le système
checkIfSiteIsBlocked()

// Revérifier périodiquement si le site est toujours dans la liste
