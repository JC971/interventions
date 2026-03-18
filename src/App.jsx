import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================
// SUPABASE
// ============================================

const supabase = createClient(
  "https://edukbapofgvrbqwxoetu.supabase.co",
  "sb_publishable_W59FXMCB2nJy79h7Dn39Ag_aZWF6gXL"
);

// ============================================
// CONFIGURATION ET DONNÉES
// ============================================

const USERS = [
  { id: 1, username: "admin", password: "admin123", role: "admin", name: "Administrateur" },
  { id: 2, username: "intervenant1", password: "pass123", role: "intervenant", name: "Laurence Dupont" },
  { id: 3, username: "intervenant2", password: "pass123", role: "intervenant", name: "Jean Martin" },
];

const ETAT_COLORS = {
  bon: { bg: "#10b981", label: "Bon" },
  moyen: { bg: "#f59e0b", label: "Moyen" },
  mauvais: { bg: "#ef4444", label: "Mauvais" },
};

const STORAGE_KEY = "interventions_data";
const USER_STORAGE_KEY = "current_user";

// Fonction pour calculer la durée entre deux heures
const calculateDuration = (heureDebut, heureFin) => {
  if (!heureDebut || !heureFin) return null;
  
  const [startHours, startMinutes] = heureDebut.split(':').map(Number);
  const [endHours, endMinutes] = heureFin.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  let diffMinutes = endTotalMinutes - startTotalMinutes;
  
  // Si négatif, l'intervention a traversé minuit
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  return { hours, minutes, totalMinutes: diffMinutes };
};

// Fonction pour formater la durée en texte lisible
const formatDuration = (duration) => {
  if (!duration) return "—";
  
  const { hours, minutes } = duration;
  
  if (hours === 0) {
    return `${minutes} min`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}min`;
  }
};

// ============================================
// HOOKS PERSONNALISÉS
// ============================================

// Hook pour détecter la taille d'écran
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    isMobile: typeof window !== "undefined" ? window.innerWidth < 768 : false,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        isMobile: window.innerWidth < 768,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
};

// Hook pour détecter le statut en ligne/hors ligne
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};

// Hook pour l'installation PWA
const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    return outcome === "accepted";
  };

  return { canInstall: !!installPrompt, isInstalled, promptInstall };
};

// ============================================
// COMPOSANTS UI
// ============================================

// Bannière hors ligne
const OfflineBanner = () => (
  <div style={styles.offlineBanner}>
    <span>📡 Vous êtes hors ligne - Les données sont sauvegardées localement</span>
  </div>
);

// Bannière d'installation PWA
const InstallBanner = ({ onInstall, onDismiss }) => (
  <div style={styles.installBanner}>
    <div style={styles.installBannerContent}>
      <span style={styles.installBannerIcon}>📱</span>
      <div style={styles.installBannerText}>
        <strong>Installer l'application</strong>
        <span>Accédez rapidement depuis votre écran d'accueil</span>
      </div>
    </div>
    <div style={styles.installBannerButtons}>
      <button onClick={onDismiss} style={styles.installBannerDismiss}>Plus tard</button>
      <button onClick={onInstall} style={styles.installBannerAccept}>Installer</button>
    </div>
  </div>
);

// Composant Badge
const Badge = ({ etat }) => (
  <span style={{ ...styles.badge, backgroundColor: ETAT_COLORS[etat]?.bg || "#6b7280" }}>
    {ETAT_COLORS[etat]?.label || etat}
  </span>
);

// Ligne d'information
const InfoRow = ({ icon, label, value, isMobile }) => (
  <div style={{
    ...styles.infoRow,
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "flex-start" : "flex-start",
    gap: isMobile ? "0.2rem" : "0.5rem",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={styles.infoIcon}>{icon}</span>
      <span style={styles.infoLabel}>{label}:</span>
    </div>
    <span style={styles.infoValue}>{value}</span>
  </div>
);

// Carte d'intervention
const InterventionCard = memo(({ intervention, currentUser, onEdit, onDelete, isMobile }) => {
  const canEdit = currentUser.role === "admin" || intervention.intervenant === currentUser.name;
  const canDelete = currentUser.role === "admin";
  
  // Calculer la durée
  const duration = calculateDuration(intervention.heureDebut, intervention.heureFin);
  const durationText = formatDuration(duration);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{intervention.bien}</h3>
        <Badge etat={intervention.etatGeneral} />
      </div>
      
      <div style={styles.cardBody}>
        <InfoRow icon="📍" label="Adresse" value={intervention.adresse} isMobile={isMobile} />
        <InfoRow icon="📅" label="Date" value={new Date(intervention.date).toLocaleDateString("fr-FR")} isMobile={isMobile} />
        <InfoRow icon="👤" label="Intervenant" value={intervention.intervenant} isMobile={isMobile} />
        <InfoRow icon="🕐" label="Horaires" value={`${intervention.heureDebut} - ${intervention.heureFin}`} isMobile={isMobile} />
        <div style={styles.durationRow}>
          <span style={styles.durationIcon}>⏱️</span>
          <span style={styles.durationLabel}>Durée :</span>
          <span style={styles.durationValue}>{durationText}</span>
        </div>
        {intervention.remarques && (
          <InfoRow icon="💬" label="Remarques" value={intervention.remarques} isMobile={isMobile} />
        )}
      </div>

      {(canEdit || canDelete) && (
        <div style={styles.cardFooter}>
          {canEdit && (
            <button onClick={() => onEdit(intervention)} style={styles.btnEdit}>
              ✏️ Modifier
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(intervention.id)} style={styles.btnDelete}>
              🗑️ Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// Modal de connexion
const LoginModal = ({ onLogin, isMobile }) => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = USERS.find(u => u.username === form.username && u.password === form.password);
    if (user) {
      onLogin(user, rememberMe);
    } else {
      setError("Identifiants incorrects");
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={{
        ...styles.loginModal,
        margin: isMobile ? "1rem" : "0",
        maxWidth: isMobile ? "100%" : "420px",
        borderRadius: isMobile ? "16px" : "20px",
      }}>
        <div style={{
          ...styles.loginHeader,
          padding: isMobile ? "1.5rem 1rem" : "2rem",
        }}>
          <span style={{ ...styles.loginIcon, fontSize: isMobile ? "2.5rem" : "3rem" }}>🏠</span>
          <h2 style={{ ...styles.loginTitle, fontSize: isMobile ? "1.25rem" : "1.5rem" }}>
            Gestion des Interventions
          </h2>
          <p style={styles.loginSubtitle}>Connectez-vous pour accéder à l'application</p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...styles.form, padding: isMobile ? "1rem" : "1.5rem" }}>
          {error && <div style={styles.errorMessage}>{error}</div>}
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Nom d'utilisateur</label>
            <input
              style={{ ...styles.input, ...styles.inputMobile }}
              type="text"
              value={form.username}
              onChange={(e) => { setForm({ ...form, username: e.target.value }); setError(""); }}
              placeholder="Entrez votre identifiant"
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Mot de passe</label>
            <input
              style={{ ...styles.input, ...styles.inputMobile }}
              type="password"
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(""); }}
              placeholder="Entrez votre mot de passe"
              autoComplete="current-password"
            />
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={styles.checkbox}
              />
              <span>Se souvenir de moi</span>
            </label>
          </div>
          
          <button type="submit" style={{ ...styles.btnPrimary, ...styles.btnMobile, width: "100%" }}>
            Se connecter
          </button>
        </form>

        <div style={{ ...styles.testAccounts, padding: isMobile ? "1rem" : "1.5rem" }}>
          <p style={styles.testAccountsTitle}>🔑 Comptes de démonstration</p>
          <div style={styles.accountsList}>
            <div style={styles.accountItem}>
              <span style={styles.accountRole}>Admin</span>
              <code style={{ fontSize: isMobile ? "0.8rem" : "0.85rem" }}>admin / admin123</code>
            </div>
            <div style={styles.accountItem}>
              <span style={styles.accountRole}>Intervenant</span>
              <code style={{ fontSize: isMobile ? "0.8rem" : "0.85rem" }}>intervenant1 / pass123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal d'intervention
const InterventionModal = ({ intervention, currentUser, onSave, onClose, isMobile }) => {
  const isEditing = !!intervention;
  const [form, setForm] = useState(intervention || {
    bien: "",
    adresse: "",
    date: new Date().toISOString().split('T')[0],
    etatGeneral: "bon",
    heureDebut: "",
    heureFin: "",
    remarques: "",
    intervenant: currentUser.role === "intervenant" ? currentUser.name : "",
  });
  const [errors, setErrors] = useState({});
  
  // Calcul de la durée en temps réel
  const previewDuration = calculateDuration(form.heureDebut, form.heureFin);
  const previewDurationText = formatDuration(previewDuration);

  const validate = () => {
    const newErrors = {};
    if (!form.bien.trim()) newErrors.bien = "Le nom du bien est requis";
    if (!form.adresse.trim()) newErrors.adresse = "L'adresse est requise";
    if (!form.date) newErrors.date = "La date est requise";
    if (!form.heureDebut) newErrors.heureDebut = "L'heure de début est requise";
    if (!form.heureFin) newErrors.heureFin = "L'heure de fin est requise";
    if (!form.intervenant) newErrors.intervenant = "L'intervenant est requis";
    if (form.heureDebut && form.heureFin && form.heureDebut >= form.heureFin) {
      newErrors.heureFin = "L'heure de fin doit être après l'heure de début";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(form);
    }
  };

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div 
        style={{
          ...styles.modal,
          margin: isMobile ? "0" : "1rem",
          borderRadius: isMobile ? "20px 20px 0 0" : "20px",
          maxHeight: isMobile ? "95vh" : "90vh",
          position: isMobile ? "absolute" : "relative",
          bottom: isMobile ? 0 : "auto",
          left: isMobile ? 0 : "auto",
          right: isMobile ? 0 : "auto",
          maxWidth: isMobile ? "100%" : "600px",
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          ...styles.modalHeader,
          padding: isMobile ? "1rem" : "1.5rem",
        }}>
          <h2 style={{ ...styles.modalTitle, fontSize: isMobile ? "1.1rem" : "1.25rem" }}>
            {isEditing ? "✏️ Modifier" : "➕ Nouvelle intervention"}
          </h2>
          <button onClick={onClose} style={styles.btnClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ ...styles.form, padding: isMobile ? "1rem" : "1.5rem" }}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nom du bien *</label>
              <input
                style={{ ...styles.input, ...styles.inputMobile, ...(errors.bien && styles.inputError) }}
                type="text"
                value={form.bien}
                onChange={(e) => updateField("bien", e.target.value)}
                placeholder="Ex: Appartement T2 Centre-ville"
              />
              {errors.bien && <span style={styles.errorText}>{errors.bien}</span>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Adresse *</label>
              <input
                style={{ ...styles.input, ...styles.inputMobile, ...(errors.adresse && styles.inputError) }}
                type="text"
                value={form.adresse}
                onChange={(e) => updateField("adresse", e.target.value)}
                placeholder="Ex: 15 rue de la République, 75001 Paris"
              />
              {errors.adresse && <span style={styles.errorText}>{errors.adresse}</span>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Date *</label>
              <input
                style={{ ...styles.input, ...styles.inputMobile, ...(errors.date && styles.inputError) }}
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
              {errors.date && <span style={styles.errorText}>{errors.date}</span>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>État général à l'arrivée *</label>
              <select
                style={{ ...styles.input, ...styles.inputMobile }}
                value={form.etatGeneral}
                onChange={(e) => updateField("etatGeneral", e.target.value)}
              >
                <option value="bon">✅ Bon</option>
                <option value="moyen">⚠️ Moyen</option>
                <option value="mauvais">❌ Mauvais</option>
              </select>
            </div>

            <div style={{
              ...styles.formRow,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Heure de début *</label>
                <input
                  style={{ ...styles.input, ...styles.inputMobile, ...(errors.heureDebut && styles.inputError) }}
                  type="time"
                  value={form.heureDebut}
                  onChange={(e) => updateField("heureDebut", e.target.value)}
                />
                {errors.heureDebut && <span style={styles.errorText}>{errors.heureDebut}</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Heure de fin *</label>
                <input
                  style={{ ...styles.input, ...styles.inputMobile, ...(errors.heureFin && styles.inputError) }}
                  type="time"
                  value={form.heureFin}
                  onChange={(e) => updateField("heureFin", e.target.value)}
                />
                {errors.heureFin && <span style={styles.errorText}>{errors.heureFin}</span>}
              </div>
            </div>

            {/* Aperçu de la durée */}
            {form.heureDebut && form.heureFin && (
              <div style={styles.durationPreview}>
                <span style={styles.durationPreviewIcon}>⏱️</span>
                <span style={styles.durationPreviewLabel}>Durée de l'intervention :</span>
                <span style={styles.durationPreviewValue}>{previewDurationText}</span>
              </div>
            )}

            {currentUser.role === "admin" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Intervenant *</label>
                <select
                  style={{ ...styles.input, ...styles.inputMobile, ...(errors.intervenant && styles.inputError) }}
                  value={form.intervenant}
                  onChange={(e) => updateField("intervenant", e.target.value)}
                >
                  <option value="">-- Sélectionner --</option>
                  {USERS.filter(u => u.role === "intervenant").map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
                {errors.intervenant && <span style={styles.errorText}>{errors.intervenant}</span>}
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Remarques</label>
              <textarea
                style={{ ...styles.input, ...styles.inputMobile, minHeight: "80px", resize: "vertical" }}
                value={form.remarques}
                onChange={(e) => updateField("remarques", e.target.value)}
                placeholder="Ajouter des remarques..."
              />
            </div>
          </div>

          <div style={{
            ...styles.modalFooter,
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "0.75rem" : "1rem",
          }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ 
                ...styles.btnSecondary, 
                ...styles.btnMobile,
                width: isMobile ? "100%" : "auto",
                order: isMobile ? 2 : 1,
              }}
            >
              Annuler
            </button>
            <button 
              type="submit" 
              style={{ 
                ...styles.btnPrimary, 
                ...styles.btnMobile,
                width: isMobile ? "100%" : "auto",
                order: isMobile ? 1 : 2,
              }}
            >
              {isEditing ? "💾 Enregistrer" : "✅ Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Header Mobile
const MobileHeader = ({ currentUser, onLogout, onMenuToggle, isMenuOpen, canInstall, onInstall }) => (
  <header style={styles.headerMobile}>
    <div style={styles.headerMobileTop}>
      <div style={styles.headerLeft}>
        <span style={{ fontSize: "1.5rem" }}>🏠</span>
        <h1 style={{ ...styles.headerTitle, fontSize: "1.1rem" }}>Interventions</h1>
      </div>
      <button onClick={onMenuToggle} style={styles.btnMenu}>
        {isMenuOpen ? "✕" : "☰"}
      </button>
    </div>
    
    {isMenuOpen && (
      <div style={styles.mobileMenu}>
        <div style={styles.mobileMenuUser}>
          <span style={styles.userAvatarMobile}>
            {currentUser.role === "admin" ? "👑" : "👤"}
          </span>
          <div>
            <div style={styles.userNameMobile}>{currentUser.name}</div>
            <div style={styles.userRoleMobile}>
              {currentUser.role === "admin" ? "Administrateur" : "Intervenant"}
            </div>
          </div>
        </div>
        {canInstall && (
          <button onClick={onInstall} style={styles.btnInstallMenu}>
            📲 Installer l'application
          </button>
        )}
        <button onClick={onLogout} style={styles.btnLogoutMobile}>
          🚪 Déconnexion
        </button>
      </div>
    )}
  </header>
);

// Header Desktop
const DesktopHeader = ({ currentUser, onLogout, canInstall, onInstall }) => (
  <header style={styles.header}>
    <div style={styles.headerLeft}>
      <span style={styles.logo}>🏠</span>
      <h1 style={styles.headerTitle}>Gestion des Interventions</h1>
    </div>
    <div style={styles.headerRight}>
      {canInstall && (
        <button onClick={onInstall} style={styles.btnInstall}>
          📲 Installer
        </button>
      )}
      <div style={styles.userInfo}>
        <span style={styles.userAvatar}>
          {currentUser.role === "admin" ? "👑" : "👤"}
        </span>
        <div style={styles.userDetails}>
          <span style={styles.userName}>{currentUser.name}</span>
          <span style={styles.userRole}>
            {currentUser.role === "admin" ? "Administrateur" : "Intervenant"}
          </span>
        </div>
      </div>
      <button onClick={onLogout} style={styles.btnLogout}>
        Déconnexion
      </button>
    </div>
  </header>
);

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

const App = () => {
  const { isMobile } = useWindowSize();
  const isOnline = useOnlineStatus();
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEtat, setFilterEtat] = useState("all");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | success | error

  // Charger l'utilisateur sauvegardé
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUser) {
        const user = JSON.parse(savedUser);
        // Vérifier que l'utilisateur existe toujours
        const validUser = USERS.find(u => u.id === user.id);
        if (validUser) {
          setCurrentUser(validUser);
        }
      }
    } catch (error) {
      console.error("Erreur chargement utilisateur:", error);
    }
    setIsLoading(false);
  }, []);

  // Charger les interventions
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setInterventions(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Erreur chargement données:", error);
    }
  }, []);

  // Sauvegarder les interventions
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(interventions));
    } catch (error) {
      console.error("Erreur sauvegarde données:", error);
    }
  }, [interventions]);

  // Afficher la bannière d'installation après un délai
  useEffect(() => {
    if (canInstall && !isInstalled) {
      const timer = setTimeout(() => {
        const dismissed = localStorage.getItem("install_banner_dismissed");
        if (!dismissed) {
          setShowInstallBanner(true);
        }
      }, 30000); // 30 secondes
      return () => clearTimeout(timer);
    }
  }, [canInstall, isInstalled]);

  // Vérifier si action=new dans l'URL (raccourci PWA)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new" && currentUser) {
      setShowModal(true);
      // Nettoyer l'URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [currentUser]);

  const handleLogin = (user, remember) => {
    setCurrentUser(user);
    if (remember) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    setIsMenuOpen(false);
  };

  const openModal = useCallback((intervention = null) => {
    setEditingIntervention(intervention);
    setShowModal(true);
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setEditingIntervention(null);
  };

  const handleSaveIntervention = (formData) => {
    if (editingIntervention) {
      const id = editingIntervention.id;
      setInterventions(prev => prev.map(i =>
        i.id === id
          ? { ...formData, id: i.id, createdBy: i.createdBy, createdAt: i.createdAt, updatedAt: new Date().toISOString() }
          : i
      ));
    } else {
      const newIntervention = {
        ...formData,
        id: Date.now(),
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      setInterventions(prev => [...prev, newIntervention]);
    }
    closeModal();
  };

  const handleDeleteIntervention = useCallback((id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette intervention ?")) {
      setInterventions(prev => prev.filter(i => i.id !== id));
    }
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setShowInstallBanner(false);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem("install_banner_dismissed", "true");
  };

  const handleSync = async () => {
    if (!isOnline) {
      alert("Vous êtes hors ligne. Connectez-vous à internet pour synchroniser.");
      return;
    }
    if (interventions.length === 0) {
      alert("Aucune donnée à synchroniser.");
      return;
    }
    setSyncStatus("syncing");
    try {
      const rows = interventions.map((i) => ({
        id: i.id,
        bien: i.bien,
        adresse: i.adresse,
        date: i.date,
        heure_debut: i.heureDebut,
        heure_fin: i.heureFin,
        intervenant: i.intervenant,
        etat_general: i.etatGeneral,
        remarques: i.remarques || null,
        created_by: i.createdBy,
        created_at: i.createdAt,
        updated_at: i.updatedAt || null,
      }));
      const { error } = await supabase
        .from("interventions")
        .upsert(rows, { onConflict: "id" });
      if (error) throw error;
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      console.error("Erreur sync:", err);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  };

  const filteredInterventions = useMemo(() => {
    let filtered = currentUser?.role === "admin"
      ? interventions
      : interventions.filter(i => i.intervenant === currentUser?.name);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.bien.toLowerCase().includes(term) ||
        i.adresse.toLowerCase().includes(term) ||
        i.intervenant.toLowerCase().includes(term)
      );
    }

    if (filterEtat !== "all") {
      filtered = filtered.filter(i => i.etatGeneral === filterEtat);
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [interventions, currentUser, searchTerm, filterEtat]);

  const stats = useMemo(() => {
    let bon = 0, moyen = 0, mauvais = 0, totalMinutes = 0;
    for (const i of filteredInterventions) {
      if (i.etatGeneral === "bon") bon++;
      else if (i.etatGeneral === "moyen") moyen++;
      else if (i.etatGeneral === "mauvais") mauvais++;
      const d = calculateDuration(i.heureDebut, i.heureFin);
      if (d) totalMinutes += d.totalMinutes;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return {
      total: filteredInterventions.length,
      tempsTotal: mins > 0 ? `${hours}h${mins}` : `${hours}h`,
      bon,
      moyen,
      mauvais,
    };
  }, [filteredInterventions]);

  // Écran de chargement
  if (isLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Chargement...</p>
      </div>
    );
  }

  // Écran de connexion
  if (!currentUser) {
    return <LoginModal onLogin={handleLogin} isMobile={isMobile} />;
  }

  return (
    <div style={styles.app}>
      {/* Bannière hors ligne */}
      {!isOnline && <OfflineBanner />}
      
      {/* Bannière d'installation */}
      {showInstallBanner && !isInstalled && (
        <InstallBanner onInstall={handleInstall} onDismiss={dismissInstallBanner} />
      )}

      {/* Header */}
      {isMobile ? (
        <MobileHeader 
          currentUser={currentUser} 
          onLogout={handleLogout}
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
          isMenuOpen={isMenuOpen}
          canInstall={canInstall && !isInstalled}
          onInstall={handleInstall}
        />
      ) : (
        <DesktopHeader 
          currentUser={currentUser} 
          onLogout={handleLogout}
          canInstall={canInstall && !isInstalled}
          onInstall={handleInstall}
        />
      )}

      <main style={{ ...styles.main, padding: isMobile ? "1rem" : "2rem" }}>
        {/* Toolbar */}
        <div style={{
          ...styles.toolbar,
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "0.75rem" : "1rem",
        }}>
          <button
            onClick={() => openModal()}
            style={{
              ...styles.btnPrimary,
              ...styles.btnMobile,
              width: isMobile ? "100%" : "auto",
            }}
          >
            ➕ Nouvelle Intervention
          </button>

          <button
            onClick={handleSync}
            disabled={syncStatus === "syncing" || !isOnline}
            style={{
              ...styles.btnSync,
              width: isMobile ? "100%" : "auto",
              opacity: syncStatus === "syncing" || !isOnline ? 0.6 : 1,
              cursor: syncStatus === "syncing" || !isOnline ? "not-allowed" : "pointer",
            }}
          >
            {syncStatus === "syncing" && "⏳ Sync en cours..."}
            {syncStatus === "success" && "✅ Synchronisé !"}
            {syncStatus === "error" && "❌ Erreur sync"}
            {syncStatus === "idle" && "☁️ Synchroniser"}
          </button>

          {isMobile && (
            <button 
              onClick={() => setShowFilters(!showFilters)}
              style={{ ...styles.btnFilter, width: "100%" }}
            >
              🔍 {showFilters ? "Masquer filtres" : "Afficher filtres"}
            </button>
          )}

          {(!isMobile || showFilters) && (
            <div style={{
              ...styles.toolbarRight,
              width: isMobile ? "100%" : "auto",
              flexDirection: isMobile ? "column" : "row",
            }}>
              <input
                style={{
                  ...styles.searchInput,
                  ...styles.inputMobile,
                  width: isMobile ? "100%" : "220px",
                }}
                type="text"
                placeholder="🔍 Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                style={{
                  ...styles.filterSelect,
                  ...styles.inputMobile,
                  width: isMobile ? "100%" : "auto",
                }}
                value={filterEtat}
                onChange={(e) => setFilterEtat(e.target.value)}
              >
                <option value="all">Tous les états</option>
                <option value="bon">✅ Bon</option>
                <option value="moyen">⚠️ Moyen</option>
                <option value="mauvais">❌ Mauvais</option>
              </select>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          ...styles.stats,
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))",
          gap: isMobile ? "0.75rem" : "1rem",
        }}>
          <div style={{ ...styles.statCard, padding: isMobile ? "1rem" : "1.25rem" }}>
            <span style={{ ...styles.statNumber, fontSize: isMobile ? "1.5rem" : "2rem" }}>
              {stats.total}
            </span>
            <span style={styles.statLabel}>Total</span>
          </div>
          <div style={{ ...styles.statCard, padding: isMobile ? "1rem" : "1.25rem" }}>
            <span style={{ ...styles.statNumber, fontSize: isMobile ? "1.5rem" : "2rem", color: "#667eea" }}>
              {stats.tempsTotal}
            </span>
            <span style={styles.statLabel}>Temps total</span>
          </div>
          <div style={{ ...styles.statCard, padding: isMobile ? "1rem" : "1.25rem" }}>
            <span style={{ ...styles.statNumber, fontSize: isMobile ? "1.5rem" : "2rem", color: "#10b981" }}>
              {stats.bon}
            </span>
            <span style={styles.statLabel}>Bon</span>
          </div>
          <div style={{ ...styles.statCard, padding: isMobile ? "1rem" : "1.25rem" }}>
            <span style={{ ...styles.statNumber, fontSize: isMobile ? "1.5rem" : "2rem", color: "#f59e0b" }}>
              {stats.moyen}
            </span>
            <span style={styles.statLabel}>Moyen</span>
          </div>
          <div style={{ ...styles.statCard, padding: isMobile ? "1rem" : "1.25rem" }}>
            <span style={{ ...styles.statNumber, fontSize: isMobile ? "1.5rem" : "2rem", color: "#ef4444" }}>
              {stats.mauvais}
            </span>
            <span style={styles.statLabel}>Mauvais</span>
          </div>
        </div>

        {/* Liste */}
        {filteredInterventions.length === 0 ? (
          <div style={{ ...styles.emptyState, padding: isMobile ? "2rem 1rem" : "4rem 2rem" }}>
            <span style={{ ...styles.emptyIcon, fontSize: isMobile ? "3rem" : "4rem" }}>📋</span>
            <h3 style={styles.emptyTitle}>Aucune intervention trouvée</h3>
            <p style={styles.emptyText}>
              {searchTerm || filterEtat !== "all"
                ? "Essayez de modifier vos critères de recherche"
                : "Cliquez sur \"Nouvelle Intervention\" pour en créer une"}
            </p>
          </div>
        ) : (
          <div style={{
            ...styles.grid,
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(350px, 1fr))",
            gap: isMobile ? "1rem" : "1.5rem",
          }}>
            {filteredInterventions.map(intervention => (
              <InterventionCard
                key={intervention.id}
                intervention={intervention}
                currentUser={currentUser}
                onEdit={openModal}
                onDelete={handleDeleteIntervention}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB Mobile */}
      {isMobile && (
        <button 
          onClick={() => openModal()} 
          style={styles.fab}
          aria-label="Nouvelle intervention"
        >
          ➕
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <InterventionModal
          intervention={editingIntervention}
          currentUser={currentUser}
          onSave={handleSaveIntervention}
          onClose={closeModal}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

// ============================================
// STYLES
// ============================================

const styles = {
  app: {
    minHeight: "100vh",
    backgroundColor: "#f0f4f8",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    paddingBottom: "80px",
  },
  // Loading
  loadingScreen: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  loadingSpinner: {
    width: "50px",
    height: "50px",
    border: "4px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "white",
    marginTop: "1rem",
    fontSize: "1.1rem",
  },
  // Offline Banner
  offlineBanner: {
    background: "#fbbf24",
    color: "#78350f",
    padding: "0.75rem 1rem",
    textAlign: "center",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  // Install Banner
  installBanner: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  installBannerContent: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  installBannerIcon: {
    fontSize: "2rem",
  },
  installBannerText: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.9rem",
  },
  installBannerButtons: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
  },
  installBannerDismiss: {
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.5)",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  installBannerAccept: {
    background: "white",
    color: "#667eea",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  // Header Desktop
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "1rem 2rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
    boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)",
  },
  // Header Mobile
  headerMobile: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerMobileTop: {
    padding: "0.75rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  btnMenu: {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    color: "white",
    fontSize: "1.5rem",
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileMenu: {
    padding: "1rem",
    borderTop: "1px solid rgba(255,255,255,0.2)",
  },
  mobileMenuUser: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  userAvatarMobile: {
    fontSize: "1.75rem",
    width: "48px",
    height: "48px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userNameMobile: {
    color: "white",
    fontWeight: 600,
  },
  userRoleMobile: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "0.85rem",
  },
  btnInstallMenu: {
    width: "100%",
    background: "white",
    color: "#667eea",
    border: "none",
    padding: "0.75rem",
    borderRadius: "10px",
    fontSize: "1rem",
    cursor: "pointer",
    fontWeight: 600,
    marginBottom: "0.75rem",
  },
  btnLogoutMobile: {
    width: "100%",
    background: "rgba(255,255,255,0.15)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.3)",
    padding: "0.75rem",
    borderRadius: "10px",
    fontSize: "1rem",
    cursor: "pointer",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  logo: {
    fontSize: "2rem",
  },
  headerTitle: {
    color: "white",
    fontSize: "1.5rem",
    margin: 0,
    fontWeight: 600,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  btnInstall: {
    background: "white",
    color: "#667eea",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  userAvatar: {
    fontSize: "1.5rem",
    width: "40px",
    height: "40px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userDetails: {
    display: "flex",
    flexDirection: "column",
  },
  userName: {
    color: "white",
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  userRole: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "0.8rem",
  },
  btnLogout: {
    background: "rgba(255,255,255,0.15)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.3)",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  main: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "2rem",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  toolbarRight: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "0.625rem 1rem",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "0.95rem",
    width: "220px",
    outline: "none",
    backgroundColor: "white",
  },
  filterSelect: {
    padding: "0.625rem 1rem",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "0.95rem",
    background: "white",
    cursor: "pointer",
    outline: "none",
  },
  btnFilter: {
    background: "white",
    color: "#475569",
    border: "2px solid #e2e8f0",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    fontSize: "1rem",
    cursor: "pointer",
  },
  stats: {
    display: "grid",
    gap: "1rem",
    marginBottom: "2rem",
  },
  statCard: {
    background: "white",
    padding: "1.25rem",
    borderRadius: "12px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  statNumber: {
    display: "block",
    fontSize: "2rem",
    fontWeight: 700,
    color: "#667eea",
  },
  statLabel: {
    color: "#64748b",
    fontSize: "0.85rem",
  },
  grid: {
    display: "grid",
    gap: "1.5rem",
  },
  card: {
    background: "white",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  cardHeader: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "1.25rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "white",
    fontSize: "1.1rem",
    margin: 0,
    fontWeight: 600,
    flex: 1,
    marginRight: "0.5rem",
  },
  badge: {
    padding: "0.3rem 0.8rem",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "white",
    flexShrink: 0,
  },
  cardBody: {
    padding: "1.25rem",
  },
  infoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    marginBottom: "0.6rem",
    fontSize: "0.9rem",
  },
  infoIcon: {
    flexShrink: 0,
  },
  infoLabel: {
    fontWeight: 600,
    color: "#475569",
    flexShrink: 0,
  },
  infoValue: {
    color: "#64748b",
    wordBreak: "break-word",
  },
  // Duration row styles
  durationRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.6rem",
    fontSize: "0.9rem",
    background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    marginTop: "0.5rem",
  },
  durationIcon: {
    fontSize: "1.1rem",
  },
  durationLabel: {
    fontWeight: 600,
    color: "#667eea",
  },
  durationValue: {
    color: "#764ba2",
    fontWeight: 700,
    fontSize: "1rem",
  },
  // Duration preview in form
  durationPreview: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "0.875rem 1rem",
    borderRadius: "10px",
    marginBottom: "1.25rem",
  },
  durationPreviewIcon: {
    fontSize: "1.25rem",
  },
  durationPreviewLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: "0.9rem",
  },
  durationPreviewValue: {
    color: "white",
    fontWeight: 700,
    fontSize: "1.1rem",
  },
  cardFooter: {
    padding: "1rem 1.25rem",
    background: "#f8fafc",
    display: "flex",
    gap: "0.75rem",
    borderTop: "1px solid #e2e8f0",
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    background: "white",
    borderRadius: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  emptyIcon: {
    fontSize: "4rem",
    display: "block",
    marginBottom: "1rem",
  },
  emptyTitle: {
    color: "#334155",
    margin: "0 0 0.5rem",
  },
  emptyText: {
    color: "#64748b",
    margin: 0,
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    zIndex: 1000,
  },
  loginModal: {
    background: "white",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
    overflow: "hidden",
  },
  loginHeader: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "2rem",
    textAlign: "center",
  },
  loginIcon: {
    fontSize: "3rem",
    display: "block",
    marginBottom: "0.5rem",
  },
  loginTitle: {
    color: "white",
    margin: "0 0 0.5rem",
    fontSize: "1.5rem",
  },
  loginSubtitle: {
    color: "rgba(255,255,255,0.8)",
    margin: 0,
    fontSize: "0.9rem",
  },
  modal: {
    background: "white",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "600px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
  },
  modalHeader: {
    padding: "1.5rem",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    background: "white",
    zIndex: 1,
  },
  modalTitle: {
    color: "#1e293b",
    fontSize: "1.25rem",
    margin: 0,
  },
  form: {
    padding: "1.5rem",
  },
  formGrid: {},
  formGroup: {
    marginBottom: "1.25rem",
  },
  formRow: {
    display: "grid",
    gap: "1rem",
  },
  label: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: 600,
    color: "#475569",
    fontSize: "0.9rem",
  },
  input: {
    width: "100%",
    padding: "0.75rem",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "1rem",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "white",
  },
  inputMobile: {
    padding: "0.875rem",
    fontSize: "16px",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: "0.8rem",
    marginTop: "0.25rem",
    display: "block",
  },
  errorMessage: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    marginBottom: "1rem",
    fontSize: "0.9rem",
    textAlign: "center",
  },
  checkboxGroup: {
    marginBottom: "1.25rem",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    color: "#475569",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    accentColor: "#667eea",
  },
  modalFooter: {
    display: "flex",
    gap: "1rem",
    justifyContent: "flex-end",
    paddingTop: "1rem",
    borderTop: "1px solid #e2e8f0",
    marginTop: "0.5rem",
  },
  testAccounts: {
    padding: "1.5rem",
    background: "#f8fafc",
  },
  testAccountsTitle: {
    fontWeight: 600,
    color: "#475569",
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
  },
  accountsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  accountItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontSize: "0.85rem",
  },
  accountRole: {
    background: "#e2e8f0",
    padding: "0.2rem 0.5rem",
    borderRadius: "4px",
    fontWeight: 600,
    color: "#475569",
    fontSize: "0.75rem",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "0.75rem 1.5rem",
    border: "none",
    borderRadius: "10px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnMobile: {
    padding: "0.875rem 1.5rem",
    minHeight: "48px",
  },
  btnSync: {
    background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    color: "white",
    padding: "0.875rem 1.5rem",
    border: "none",
    borderRadius: "10px",
    fontSize: "1rem",
    fontWeight: 600,
    minHeight: "48px",
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    background: "#64748b",
    color: "white",
    padding: "0.75rem 1.5rem",
    border: "none",
    borderRadius: "10px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnEdit: {
    flex: 1,
    background: "#3b82f6",
    color: "white",
    padding: "0.75rem 1rem",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
  },
  btnDelete: {
    flex: 1,
    background: "#ef4444",
    color: "white",
    padding: "0.75rem 1rem",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
  },
  btnClose: {
    background: "none",
    border: "none",
    fontSize: "1.75rem",
    color: "#94a3b8",
    cursor: "pointer",
    lineHeight: 1,
    padding: "0.25rem",
    borderRadius: "8px",
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    fontSize: "1.5rem",
    boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
};

export default App;
