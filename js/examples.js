// Sample seed lines for the "Try a seed" button.
// Tuned for variety: love/loss, image-forward, abstract, dramatic, sly.

export const EXAMPLE_SEEDS = {
  en: [
    "I kept your name in the mouth of winter",
    "Every room remembers what we broke",
    "I smile like someone borrowing time",
    "The radio kept playing what we couldn't say",
    "We were a city that ran out of weather",
    "She left her shoes on like a question",
    "Money is just other people's permission",
    "I learned to pray by lying about it",
    "Some doors only open from the inside of regret",
    "I miss you in a language no one taught me",
    "The dog still waits at the wrong door",
    "Half the night thinks it's the morning of you",
  ],
  fr: [
    "J'ai gardé ton nom dans la bouche de l'hiver",
    "Chaque pièce se souvient de ce qu'on a cassé",
    "Je souris comme on emprunte le temps",
    "La radio jouait toujours ce qu'on ne pouvait pas dire",
    "On était une ville qui n'avait plus de temps qu'il fait",
    "Elle gardait ses souliers comme une question",
    "L'argent n'est que la permission des autres",
    "J'ai appris à prier en mentant",
    "Certaines portes ne s'ouvrent que de l'intérieur du regret",
    "Tu me manques dans une langue que personne ne m'a apprise",
    "Le chien attend encore à la mauvaise porte",
    "La moitié de la nuit se prend pour ton matin",
  ],
};

export function getExamples(lang) {
  return EXAMPLE_SEEDS[lang] || EXAMPLE_SEEDS.en;
}
