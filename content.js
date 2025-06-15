let scrollStart = Date.now()
let totalTime = 0
let timer
let hasBlocked = false
let scrollLimit = 60000 // fallback par défaut
let isScrolling = false
let currentSite = window.location.hostname.replace(/^www\./, '')

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
  setInterval(checkBlockedStatus, 1000)

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
        showNotification(
          `Tu as scrollé trop longtemps sur ${currentSite}. Fais une pause !`,
          'warning',
        )
        bloquerPage()
        return
      }

      // Sauvegarder le statut de blocage
      const blockedKey = `scrollBlocked_${currentSite}`
      chrome.storage.local.set({ [blockedKey]: true }, () => {
        if (chrome.runtime.lastError) {
          // Erreur silencieuse, le blocage visuel fonctionnera quand même
          console.log(`❌ CONTENT - Erreur sauvegarde:`, chrome.runtime.lastError)
        } else {
          console.log(`✅ CONTENT - Clé ${blockedKey} sauvegardée avec valeur: true`)
        }
      })

      showNotification(
        `Tu as scrollé trop longtemps sur ${currentSite}. Fais une pause !`,
        'warning',
      )
      bloquerPage()
    }
  }
}

/**
 * Remplace le contenu de la page par un écran de blocage
 */
function bloquerPage() {
  document.body.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 999999;
    ">
      <div style="
        text-align: center;
        color: white;
        font-size: 24px;
        padding: 20px;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 10px;
      ">
        <p>🚫 <strong>Temps écoulé sur ${currentSite}.</strong></p>
        <p><strong>Reviens plus tard.</strong></p>
      </div>
    </div>
  `
}

function showNotification(message, type = 'warning') {
  const toast = document.createElement('div')
  toast.className = `scroll-blocker-toast ${type}`
  toast.innerHTML = `
    <span style="font-weight: bold;">${type === 'warning' ? '⚠' : '✓'}</span>
    <span>${message}</span>
  `

  // Styles pour la notification
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: '999999',
    backgroundColor: type === 'warning' ? '#fff3cd' : '#d4edda',
    color: type === 'warning' ? '#856404' : '#155724',
    borderLeft: `4px solid ${type === 'warning' ? '#ffc107' : '#28a745'}`,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transform: 'translateX(100%)',
    transition: 'transform 0.3s ease',
  })

  document.body.appendChild(toast)

  // Animation d'entrée
  setTimeout(() => (toast.style.transform = 'translateX(0)'), 10)

  // Animation de sortie et suppression
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

// Initialiser le système
checkIfSiteIsBlocked()

// Revérifier périodiquement si le site est toujours dans la liste
