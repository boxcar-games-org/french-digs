import type { Player } from './Player';
import type { Terrain } from './Terrain';

type WordPair = {
	fr: string;
	en: string;
};

export class WordManager {
	words: WordPair[] = [
		{ fr: 'bonjour', en: 'hello' },
		{ fr: 'merci', en: 'thank you' },
		{ fr: 'amour', en: 'love' },
		{ fr: 'soleil', en: 'sun' },
		{ fr: 'lune', en: 'moon' },
		{ fr: 'etoile', en: 'star' },
		{ fr: 'chat', en: 'cat' },
		{ fr: 'chien', en: 'dog' },
		{ fr: 'fleur', en: 'flower' },
		{ fr: 'monde', en: 'world' },
		{ fr: 'reve', en: 'dream' },
		{ fr: 'petit', en: 'small' },
		{ fr: 'grand', en: 'big' },
		{ fr: 'joie', en: 'joy' },
		{ fr: 'ami', en: 'friend' },
		{ fr: 'maison', en: 'house' },
		{ fr: 'livre', en: 'book' },
		{ fr: 'temps', en: 'time' },
		{ fr: 'jour', en: 'day' },
		{ fr: 'nuit', en: 'night' },
		{ fr: 'eau', en: 'water' },
		{ fr: 'pain', en: 'bread' },
		{ fr: 'vin', en: 'wine' },
		{ fr: 'cafe', en: 'coffee' },
		{ fr: 'jardin', en: 'garden' },
		{ fr: 'ville', en: 'city' },
		{ fr: 'rue', en: 'street' },
		{ fr: 'porte', en: 'door' },
		{ fr: 'fenetre', en: 'window' },
		{ fr: 'table', en: 'table' },
		{ fr: 'chaise', en: 'chair' },
		{ fr: 'lit', en: 'bed' },
		{ fr: 'main', en: 'hand' },
		{ fr: 'coeur', en: 'heart' },
		{ fr: 'tete', en: 'head' },
		{ fr: 'yeux', en: 'eyes' },
		{ fr: 'bouche', en: 'mouth' },
		{ fr: 'pied', en: 'foot' },
		{ fr: 'bras', en: 'arm' },
		{ fr: 'famille', en: 'family' },
		{ fr: 'mere', en: 'mother' },
		{ fr: 'pere', en: 'father' },
		{ fr: 'enfant', en: 'child' },
		{ fr: 'frere', en: 'brother' },
		{ fr: 'soeur', en: 'sister' },
		{ fr: 'homme', en: 'man' },
		{ fr: 'femme', en: 'woman' },
		{ fr: 'vie', en: 'life' },
		{ fr: 'mort', en: 'death' },
		{ fr: 'travail', en: 'work' },
		{ fr: 'ecole', en: 'school' },
		{ fr: 'musique', en: 'music' },
		{ fr: 'danse', en: 'dance' },
		{ fr: 'voiture', en: 'car' },
		{ fr: 'train', en: 'train' },
		{ fr: 'avion', en: 'plane' },
		{ fr: 'bateau', en: 'boat' },
		{ fr: 'mer', en: 'sea' },
		{ fr: 'montagne', en: 'mountain' },
		{ fr: 'foret', en: 'forest' },
		{ fr: 'arbre', en: 'tree' },
		{ fr: 'oiseau', en: 'bird' },
		{ fr: 'poisson', en: 'fish' },
		{ fr: 'fromage', en: 'cheese' },
		{ fr: 'beurre', en: 'butter' },
		{ fr: 'sucre', en: 'sugar' },
		{ fr: 'sel', en: 'salt' },
		{ fr: 'rouge', en: 'red' },
		{ fr: 'bleu', en: 'blue' },
		{ fr: 'vert', en: 'green' },
		{ fr: 'jaune', en: 'yellow' },
		{ fr: 'noir', en: 'black' },
		{ fr: 'blanc', en: 'white' },
		{ fr: 'gris', en: 'grey' },
		{ fr: 'beau', en: 'beautiful' },
		{ fr: 'joli', en: 'pretty' },
		{ fr: 'bon', en: 'good' },
		{ fr: 'mauvais', en: 'bad' },
		{ fr: 'heureux', en: 'happy' },
		{ fr: 'triste', en: 'sad' },
		{ fr: 'rire', en: 'to laugh' },
		{ fr: 'pleurer', en: 'to cry' },
		{ fr: 'manger', en: 'to eat' },
		{ fr: 'boire', en: 'to drink' },
		{ fr: 'dormir', en: 'to sleep' },
		{ fr: 'marcher', en: 'to walk' },
		{ fr: 'courir', en: 'to run' },
		{ fr: 'sauter', en: 'to jump' },
		{ fr: 'danser', en: 'to dance' },
		{ fr: 'chanter', en: 'to sing' },
		{ fr: 'parler', en: 'to speak' },
		{ fr: 'ecouter', en: 'to listen' },
		{ fr: 'regarder', en: 'to watch' },
		{ fr: 'lire', en: 'to read' },
		{ fr: 'ecrire', en: 'to write' },
		{ fr: 'apprendre', en: 'to learn' },
		{ fr: 'comprendre', en: 'to understand' },
		{ fr: 'savoir', en: 'to know' },
		{ fr: 'vouloir', en: 'to want' }
	];

	currentWord: WordPair = { fr: '', en: '' };
	position: { x: number; y: number } = { x: 0, y: 0 };
	score: number = 0;

	spawn(worldWidth: number, groundLevel: number, playerY: number) {
		this.currentWord = this.words[Math.floor(Math.random() * this.words.length)];

		const minX = 100;
		const maxX = worldWidth > 200 ? worldWidth - 100 : 100;

		// Place word 300–900px below the player's current position
		const minDepth = Math.max(groundLevel + 150, playerY + 300);
		const maxDepth = minDepth + 600;

		this.position = {
			x: minX + Math.random() * (maxX - minX),
			y: minDepth + Math.random() * (maxDepth - minDepth)
		};

		this.speak(this.currentWord);
	}

	checkFound(player: Player): boolean {
		const centerX = player.x + player.width / 2;
		const centerY = player.y + player.height / 2;

		const dx = centerX - this.position.x;
		const dy = centerY - this.position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 50) {
			this.speak(this.currentWord);
			this.score++;
			return true;
		}
		return false;
	}

	stopSpeech() {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
	}

	private speak(word: WordPair) {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			const frUtterance = new SpeechSynthesisUtterance(word.fr);
			frUtterance.lang = 'fr-FR';

			const enUtterance = new SpeechSynthesisUtterance(word.en);
			enUtterance.lang = 'en-US';

			window.speechSynthesis.speak(frUtterance);
			window.speechSynthesis.speak(enUtterance);
		}
	}

	draw(ctx: CanvasRenderingContext2D, terrain: Terrain) {
		const isSolid = terrain.isSolid(this.position.x, this.position.y);
		const exposed = !isSolid;

		ctx.save();
		ctx.globalAlpha = exposed ? 1.0 : 0.5;

		const { x, y } = this.position;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		ctx.font = '900 36px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
		ctx.lineWidth = 6;
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#3E2723';
		ctx.strokeText(this.currentWord.fr, x, y);

		ctx.fillStyle = '#FFD700';
		ctx.fillText(this.currentWord.fr, x, y);

		ctx.lineWidth = 1;
		ctx.strokeStyle = '#FFFFE0';
		ctx.strokeText(this.currentWord.fr, x, y);

		ctx.restore();
	}
}
