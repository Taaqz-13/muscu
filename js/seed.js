/* Bibliotheque d'exercices de depart. Les identifiants sont derives du nom
   (slug) : ne jamais renommer un exercice ICI, sinon il serait recree en double
   sur les appareils deja installes. Renommer depuis l'app, ca, c'est sans risque. */
(function (root) {
  'use strict';

  const MUSCLES = [
    'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
    'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets', 'Abdominaux',
    'Trapèzes', 'Lombaires'
  ];

  const LIST = {
    'Pectoraux': ['Développé couché barre', 'Développé couché haltères', 'Développé incliné barre',
      'Développé incliné haltères', 'Développé décliné', 'Développé couché machine',
      'Développé incliné machine', 'Écarté haltères', 'Écarté poulie vis-à-vis', 'Pec deck',
      'Dips pectoraux', 'Pompes'],
    'Dos': ['Tractions', 'Tractions supination', 'Tirage vertical poulie haute', 'Tirage vertical prise serrée',
      'Rowing barre', 'Rowing haltère un bras', 'Rowing poulie basse', 'Rowing machine',
      'Tirage horizontal machine', 'Rowing T-bar', 'Pull-over poulie', 'Soulevé de terre'],
    'Épaules': ['Développé militaire barre', 'Développé haltères assis', 'Développé épaules machine',
      'Arnold press', 'Élévations latérales haltères', 'Élévations latérales poulie',
      'Élévations frontales', 'Oiseau haltères', 'Reverse pec deck', 'Face pull'],
    'Biceps': ['Curl barre', 'Curl barre EZ', 'Curl haltères', 'Curl marteau', 'Curl incliné',
      'Curl pupitre', 'Curl poulie', 'Curl concentré'],
    'Triceps': ['Extension poulie haute corde', 'Extension poulie haute barre', 'Barre au front',
      'Extension nuque haltère', 'Dips triceps', 'Développé couché prise serrée', 'Kickback triceps',
      'Extension triceps machine'],
    'Avant-bras': ['Curl poignets', 'Farmer walk'],
    'Quadriceps': ['Squat barre', 'Front squat', 'Squat Smith machine', 'Presse à cuisses', 'Hack squat',
      'Leg extension', 'Fentes haltères', 'Fentes bulgares', 'Goblet squat'],
    'Ischio-jambiers': ['Soulevé de terre roumain', 'Soulevé de terre jambes tendues haltères',
      'Leg curl allongé', 'Leg curl assis', 'Good morning'],
    'Fessiers': ['Hip thrust', 'Pont fessier', 'Abduction machine', 'Kickback fessier poulie'],
    'Mollets': ['Mollets debout', 'Mollets assis', 'Mollets à la presse'],
    'Abdominaux': ['Crunch', 'Crunch poulie', 'Relevé de jambes suspendu', 'Roue abdominale',
      'Russian twist', 'Gainage'],
    'Trapèzes': ['Shrugs haltères', 'Shrugs barre'],
    'Lombaires': ['Extension lombaire banc 45°']
  };

  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function exercises() {
    const out = [];
    MUSCLES.forEach(function (m) {
      (LIST[m] || []).forEach(function (name) {
        out.push({ id: 'x-' + slug(name), name: name, muscle: m, updatedAt: 1 });
      });
    });
    return out;
  }

  const Seed = { MUSCLES: MUSCLES, exercises: exercises, slug: slug };
  root.Seed = Seed;
  if (typeof module !== 'undefined' && module.exports) module.exports = Seed;
})(typeof self !== 'undefined' ? self : this);
