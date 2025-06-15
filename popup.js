const siteInput = document.getElementById('siteInput')
const minutesInput = document.getElementById('minutesInput')
const siteList = document.getElementById('siteList')

/**
 * Charge les sites bloqués depuis le storage et les affiche
 * Gère automatiquement la migration de l'ancien format (array) vers le nouveau (object)
 */
function loadBlockedSites() {
  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || []

    // Migration automatique : ancien format (array) vers nouveau format (object)
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((site) => {
        newFormat[site] = 300000 // 5 minutes par défaut pour les anciens sites
      })
      sites = newFormat
      // Sauvegarder le nouveau format
      chrome.storage.local.set({ blockedSites: sites })
    }

    displaySites(sites)
  })
}

/**
 * Affiche la liste des sites bloqués dans l'interface
 * Gère intelligemment l'affichage du scroll selon le nombre d'éléments
 */
function displaySites(sites) {
  siteList.innerHTML = ''

  if (Object.keys(sites).length === 0) {
    siteList.innerHTML = '<div class="no-sites">Aucun site bloqué</div>'
    siteList.style.overflowY = 'hidden'
    return
  }

  Object.entries(sites).forEach(([site, limitMs]) => {
    const limitMinutes = Math.round(limitMs / 60000)
    const siteItem = document.createElement('div')
    siteItem.className = 'site-item'
    siteItem.innerHTML = `
      <span><strong>${site}</strong> - ${limitMinutes} min</span>
      <button class="remove-btn" data-site="${site}">✕</button>
    `
    siteList.appendChild(siteItem)
  })

  // Gérer intelligemment le scroll selon le nombre d'éléments
  const itemCount = Object.keys(sites).length
  if (itemCount <= 2) {
    siteList.style.overflowY = 'hidden'
  } else {
    siteList.style.overflowY = 'auto'
  }

  // Ajouter les event listeners pour les boutons de suppression
  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const siteToRemove = e.target.getAttribute('data-site')
      removeSite(siteToRemove)
    })
  })
}

/**
 * Crée et affiche une notification toast avec animation
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification ('success', 'error', 'warning')
 */
function showToast(message, type = 'success') {
  // Supprimer les toasts existants pour éviter les doublons
  const existingToast = document.querySelector('.toast')
  if (existingToast) {
    existingToast.remove()
  }

  // Créer la nouvelle toast
  const toast = document.createElement('div')
  toast.className = `toast ${type}`

  // Ajouter une icône selon le type
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '⚠'
  toast.innerHTML = `<span style="font-weight: bold;">${icon}</span><span>${message}</span>`

  // Ajouter au DOM
  document.body.appendChild(toast)

  // Animation d'entrée après un court délai
  setTimeout(() => toast.classList.add('show'), 10)

  // Animation de sortie et suppression automatique
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300) // Temps de l'animation de sortie
  }, 4000) // Durée d'affichage du message
}

/**
 * Ajoute un nouveau site à la liste des sites bloqués
 * Nettoie et valide le domaine avant ajout
 */
function addSite(site, minutes) {
  if (!site || site.trim() === '') {
    showToast('Veuillez entrer un nom de domaine', 'error')
    return
  }

  if (!minutes || minutes < 1) {
    showToast('Durée minimum : 1 minute', 'error')
    return
  }

  // Nettoyer le domaine
  site = site.trim().toLowerCase()
  site = site.replace(/^https?:\/\//, '')
  site = site.replace(/^www\./, '')
  site = site.split('/')[0]

  // Nouvelles validations
  if (site.length > 253) {
    // Longueur maximale d'un nom de domaine
    showToast('Le nom de domaine est trop long', 'error')
    return
  }

  if (
    !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/.test(
      site,
    )
  ) {
    showToast('Format de domaine invalide (exemple: exemple.com)', 'error')
    return
  }
  const limitMs = minutes * 60 * 1000

  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || {}

    // Vérifier si on a déjà 10 sites
    if (Object.keys(sites).length >= 10) {
      showToast('Maximum 10 sites autorisés', 'error')
      return
    }

    // Assurer la compatibilité avec l'ancien format
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((s) => {
        newFormat[s] = 300000 // 5 minutes par défaut
      })
      sites = newFormat
    }

    if (sites[site]) {
      showToast('Site déjà dans la liste', 'warning')
      return
    }

    sites[site] = limitMs
    chrome.storage.local.set({ blockedSites: sites }, () => {
      // Nettoyage préventif des données résiduelles
      const blockedKey = `scrollBlocked_${site}`
      const timeKey = `scrollTime_${site}`
      chrome.storage.local.remove([blockedKey, timeKey], () => {
        showToast(`${site} ajouté (${minutes} min) - Rechargez la page ${site}`, 'success')
        siteInput.value = ''
        minutesInput.value = 5
        loadBlockedSites()
      })
    })
  })
}

/**
 * Supprime un site de la liste des sites bloqués
 * Force le déblocage immédiat en mettant la clé à false
 */
function removeSite(site) {
  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || {}

    // Assurer la compatibilité avec l'ancien format
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((s) => {
        newFormat[s] = 300000
      })
      sites = newFormat
    }

    delete sites[site]

    chrome.storage.local.set({ blockedSites: sites }, () => {
      // Vérifier d'abord si le site est actuellement bloqué
      const blockedKey = `scrollBlocked_${site}`
      const timeKey = `scrollTime_${site}`

      chrome.storage.local.get([blockedKey], (data) => {
        // Vérifier si la valeur est true (booléen) ou 'true' (string)
        const isCurrentlyBlocked = data[blockedKey] === true || data[blockedKey] === 'true'

        // Forcer le déblocage en mettant la clé à false (au lieu de supprimer)
        // Cela permet la détection immédiate par le content script
        chrome.storage.local.set({ [blockedKey]: false }, () => {
          chrome.storage.local.remove(timeKey, () => {
            // Message adapté selon l'état du site
            const message = isCurrentlyBlocked
              ? `${site} supprimé - Débloqué automatiquement`
              : `${site} supprimé de la liste`

            showToast(message, 'success')
            loadBlockedSites()
          })
        })
      })
    })
  })
}

// === EVENT LISTENERS ===

document.getElementById('addSite').addEventListener('click', () => {
  const site = siteInput.value
  const minutes = parseInt(minutesInput.value)
  addSite(site, minutes)
})

// Initialisation : charger les sites au démarrage
loadBlockedSites()
