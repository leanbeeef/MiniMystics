import Link from "next/link";
import {
  ArrowRight,
  Backpack,
  BookOpenCheck,
  Check,
  Coins,
  Dices,
  Layers3,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  UsersRound,
  WandSparkles,
  Zap,
} from "lucide-react";
import { PACK_DEFINITIONS, STANDARD_RARITY_WEIGHTS } from "@/lib/game/packs";
import { ORDER_MATCHUPS, SYNERGY_PERCENT_BY_COUNT } from "@/lib/game/order-matchups";
import { BOOST_MATCHES } from "@/lib/game/boosts";
import { LEVEL_UP_ESSENCE_COST, MAX_MYSTIC_LEVEL, RARITY_DISMANTLE_ESSENCE, RARITY_SELL_COINS } from "@/lib/game/economy";
import { REWARD_TUNING } from "@/lib/game/rewards";

const chapters = [
  ["start", "Start here"],
  ["cards", "Cards & stats"],
  ["packs", "Opening packs"],
  ["collection", "Collection & loadouts"],
  ["campaign", "Campaigns"],
  ["battle", "Battling"],
  ["orders", "Orders & synergy"],
  ["rewards", "Rewards & progression"],
  ["friends", "Friends"],
] as const;

const rarities = Object.entries(STANDARD_RARITY_WEIGHTS) as Array<[keyof typeof STANDARD_RARITY_WEIGHTS, number]>;

function RuleSection({ id, number, icon, title, intro, children }: { id: string; number: string; icon: React.ReactNode; title: string; intro: string; children: React.ReactNode }) {
  return <section className="rules-chapter" id={id}>
    <header><span className="rules-chapter-icon">{icon}</span><div><small>CHAPTER {number}</small><h2>{title}</h2><p>{intro}</p></div></header>
    {children}
  </section>;
}

function RuleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="rule-card"><h3>{title}</h3>{children}</article>;
}

export function RulesView({ publicView = false }: { publicView?: boolean }) {
  return <div className={`page rules-page ${publicView ? "is-public" : ""}`}>
    <section className="rules-hero">
      <div><span className="eyebrow">HANDLER&apos;S FIELD GUIDE</span><h1>How to play<br /><em>Mini Mystics</em></h1><p>Everything you need to build a collection, command a formation, clear campaigns, and connect with other Handlers.</p></div>
      <div className="rules-hero-mark" aria-hidden="true"><BookOpenCheck /></div>
    </section>

    <div className="rules-layout">
      <aside className="rules-index" aria-label="Rulebook chapters">
        <span>FIELD GUIDE</span>
        <nav>{chapters.map(([id, label], index) => <a href={`#${id}`} key={id}><b>{String(index + 1).padStart(2, "0")}</b>{label}</a>)}</nav>
      </aside>

      <main className="rules-book">
        <RuleSection id="start" number="01" icon={<Sparkles />} title="Start here" intro="Your account is called a Handler. Your goal is to collect cards, build teams, and defeat every Vanguard in the ten Order campaigns.">
          <div className="rules-steps">
            <article><b>1</b><span><strong>Open your Starter Pack</strong><small>Every new Handler begins with 1 Handler, 5 Mystics, and 4 reward cards.</small></span></article>
            <article><b>2</b><span><strong>Build a formation</strong><small>Choose the exact number of Mystics required and add up to 3 supporting Handlers.</small></span></article>
            <article><b>3</b><span><strong>Enter a campaign</strong><small>Win turn-based battles, earn XP, Coins, and Order Essence, then unlock harder stages.</small></span></article>
          </div>
          <div className="rule-callout"><Check /><p><strong>Your progress saves automatically.</strong> Your collection, campaign clears, packs, profile, and battle progress are synced to your account.</p></div>
        </RuleSection>

        <RuleSection id="cards" number="02" icon={<Layers3 />} title="Cards and combat stats" intro="Mystics fight. Handlers support them. Reward cards grant resources or temporary account boosts.">
          <div className="rule-card-grid three">
            <RuleCard title="Mystic cards"><p>Every Mystic has an <strong>Order</strong>, <strong>Allegiance</strong>, rarity, Power, Defense, Base Attack, and two Special Moves.</p><ul><li><b>Power</b> is health. At 0, the Mystic is defeated.</li><li><b>Defense</b> reduces incoming damage.</li><li><b>Base Attack</b> starts the damage calculation.</li></ul></RuleCard>
            <RuleCard title="Handler cards"><p>Handlers do not take turns or enter the battlefield as fighters. Their Order and Allegiance passives modify matching Mystics for the whole battle.</p><p>If both traits match, both passives apply. A formation may equip up to three Handlers.</p></RuleCard>
            <RuleCard title="Reward cards"><p>Reward cards grant Coins, XP, 2× XP boosts, or 2× Coin boosts. Pack rewards are determined when the pack is purchased; revealing a card does not reroll it.</p></RuleCard>
          </div>
          <div className="rarity-track" aria-label="Rarity order">{rarities.map(([rarity]) => <span className={`rarity-${rarity.toLowerCase()}`} key={rarity}>{rarity}</span>)}</div>
          <p className="rules-fine-print">Rarity order, lowest to highest: Wild, Hunter, Predator, Prime, Alpha, Apex.</p>
        </RuleSection>

        <RuleSection id="packs" number="03" icon={<PackageOpen />} title="Opening packs" intro="Spend Coins in the Vault, then reveal cards individually or use Reveal All in the Pack Chamber.">
          <div className="rules-table-wrap"><table className="rules-table"><thead><tr><th>Pack</th><th>Cost</th><th>Contents</th></tr></thead><tbody>{PACK_DEFINITIONS.map((pack) => <tr key={pack.id}><td>{pack.name}</td><td>{pack.coinPrice} Coins</td><td>{pack.description}</td></tr>)}</tbody></table></div>
          <div className="rule-card-grid two">
            <RuleCard title="Mystic rarity odds"><div className="odds-list">{rarities.map(([rarity, chance]) => <span key={rarity}><b>{rarity}</b><i><em style={{ width: `${Math.max(chance, 2)}%` }} /></i><strong>{chance}%</strong></span>)}</div></RuleCard>
            <RuleCard title="Standard Pack extras"><ul><li>Five Mystic slots use the listed odds.</li><li>20% chance of a bonus Handler.</li><li>25% chance of a bonus reward card.</li><li>Those two bonus rolls are independent.</li></ul></RuleCard>
          </div>
          <div className="rule-callout gold"><Dices /><p><strong>Alpha pity:</strong> after 9 consecutive Standard Packs without an Alpha, the next Standard Pack guarantees an Alpha in its first Mystic slot. Pulling an Alpha resets the counter. Pulling an Apex does not.</p></div>
          <p className="rules-fine-print">A single Mystic draw avoids duplicate definitions whenever its eligible pool is large enough. You can still collect additional copies across different packs.</p>
        </RuleSection>

        <RuleSection id="collection" number="04" icon={<Backpack />} title="Collection, duplicates, and loadouts" intro="The Archive stores individual copies of every card you own and provides the tools used to prepare for battle.">
          <div className="rule-card-grid two">
            <RuleCard title="Loadouts and binders"><ul><li>Save separate 3-, 5-, or 8-Mystic formations.</li><li>Each loadout requires exactly its listed number of Mystics.</li><li>Add zero to three Handler cards.</li><li>Only one saved loadout per battle size can be active.</li><li>Binders organize owned card copies without changing ownership.</li></ul></RuleCard>
            <RuleCard title="Duplicate choices"><p>You must own at least two copies of a definition before selling or dismantling one.</p><ul><li><b>Sell</b> a duplicate Mystic or Handler for Coins.</li><li><b>Dismantle</b> a duplicate Mystic for Essence matching that Mystic&apos;s Order.</li><li>The chosen owned copy is permanently removed from loadouts and binders.</li></ul></RuleCard>
          </div>
          <div className="rules-mini-table"><span><b>Rarity</b><b>Sell</b><b>Dismantle</b></span>{Object.keys(RARITY_SELL_COINS).filter((rarity) => rarity !== "Unassigned").map((rarity) => <span key={rarity}><strong>{rarity}</strong><em>{RARITY_SELL_COINS[rarity as keyof typeof RARITY_SELL_COINS]} Coins</em><em>{RARITY_DISMANTLE_ESSENCE[rarity as keyof typeof RARITY_DISMANTLE_ESSENCE]} Essence</em></span>)}</div>
          <div className="rule-callout"><Zap /><p><strong>Mystic levels:</strong> spend matching Order Essence to level a Mystic from 1 to {MAX_MYSTIC_LEVEL}. Each level adds 2% to its Power, Defense, and Base Attack. Costs for levels 2–10 are {Object.values(LEVEL_UP_ESSENCE_COST).join(", ")} Essence.</p></div>
        </RuleSection>

        <RuleSection id="campaign" number="05" icon={<Trophy />} title="Campaign rules" intro="There are ten Order campaigns with five stages each. Campaign progress is recorded per stage, so cleared encounters remain replayable.">
          <div className="campaign-rule-track">{[
            ["1", "Easy", "3 Mystics", "Player Lv. 1"],
            ["2", "Easy", "3 Mystics", "Previous stage"],
            ["3", "Medium", "5 Mystics", "Previous + Lv. 2"],
            ["4", "Hard", "5 Mystics", "Previous + Lv. 4"],
            ["5", "Elite", "8 Mystics", "Previous + Lv. 6"],
          ].map(([stage, difficulty, size, unlock]) => <article key={stage}><b>{stage}</b><span><strong>{difficulty}</strong><small>{size}</small><em>{unlock}</em></span></article>)}</div>
          <div className="rule-card-grid two">
            <RuleCard title="Unlocking stages"><p>Stage 1 is open at level 1. Later stages require both the previous stage clear and the listed Handler level. You must also own enough Mystics for the battle size.</p></RuleCard>
            <RuleCard title="Clears and replays"><p>Every campaign victory awards the stage&apos;s repeat Coins and XP. The first victory also records the clear and adds its one-time Coins, XP, and Order Essence bonus. Cleared stages remain replayable.</p></RuleCard>
          </div>
        </RuleSection>

        <RuleSection id="battle" number="06" icon={<Swords />} title="Battle rules" intro="Battles are alternating-turn team fights. Defeat every opposing Mystic before your own formation is eliminated.">
          <div className="rules-steps compact">
            <article><b>1</b><span><strong>Starting roll</strong><small>You and the opponent roll a D8. Higher result acts first; ties reroll automatically.</small></span></article>
            <article><b>2</b><span><strong>Choose an actor</strong><small>On your turn, select any surviving Mystic in your formation.</small></span></article>
            <article><b>3</b><span><strong>Choose an action</strong><small>Use a Basic Attack or an available Special Move, then select the required target.</small></span></article>
            <article><b>4</b><span><strong>End the turn</strong><small>After the action resolves, play passes to the opponent and cooldowns/effects tick for the incoming side.</small></span></article>
          </div>
          <div className="rule-card-grid two">
            <RuleCard title="Basic Attacks"><p>Basic Attacks always execute, require an enemy target, use no D8 roll, and have no cooldown. Final damage can still be reduced to zero by Defense or Untouchable.</p></RuleCard>
            <RuleCard title="Special Moves"><p>Each move shows a required D8 result. Roll that number or higher to succeed. The move enters cooldown when attempted—even on a failed roll. A Silenced Mystic cannot use Specials.</p><p>Specials may attack, heal, buff, debuff, regenerate, burn, mark, retaliate, adjust cooldowns, or make a target Untouchable according to the card text.</p></RuleCard>
          </div>
          <RuleCard title="Damage is calculated in this fixed order"><ol className="damage-pipeline"><li>Leveled Base Attack</li><li>Order Advantage</li><li>Handler passive</li><li>Move and active ATK modifiers</li><li>Order Synergy</li><li>Enemy effective Defense</li><li>Final damage, never below 0</li></ol></RuleCard>
          <div className="rule-callout danger"><Shield /><p><strong>Winning and losing:</strong> a Mystic is knocked out when its current Power reaches 0. The battle ends immediately when every Mystic on one side is defeated.</p></div>
        </RuleSection>

        <RuleSection id="orders" number="07" icon={<Shield />} title="Order Advantage and team synergy" intro="Orders form a ten-step advantage cycle. Attacking the Order you counter grants +25% Attack; being countered gives no separate defensive penalty.">
          <div className="matchup-grid">{Object.entries(ORDER_MATCHUPS).map(([order, matchup]) => <article key={order}><strong>{order}</strong><span>strong against</span><b>{matchup.strongAgainst}</b></article>)}</div>
          <RuleCard title="Order Synergy"><p>Mystics sharing an Order gain an Attack bonus. Only starting Mystics count; Handlers do not. The bonus is fixed when battle begins.</p><div className="synergy-scale">{Object.entries(SYNERGY_PERCENT_BY_COUNT).map(([count, percent]) => <span key={count}><b>{count}</b><small>Mystics</small><strong>+{percent}%</strong></span>)}</div></RuleCard>
        </RuleSection>

        <RuleSection id="rewards" number="08" icon={<Coins />} title="Battle rewards and progression" intro="Every completed battle awards account XP and Coins. Wins, knockouts, surviving Mystics, battle size, stage bonuses, and active boosts affect the result.">
          <div className="rules-mini-table reward-bases"><span><b>Battle size</b><b>Base XP</b><b>Base Coins</b></span>{Object.entries(REWARD_TUNING.sizeBase).map(([size, reward]) => <span key={size}><strong>{size} Mystics</strong><em>{reward.xp} XP</em><em>{reward.coins} Coins</em></span>)}</div>
          <div className="rule-card-grid two">
            <RuleCard title="Reward modifiers"><ul><li>Victory uses a 1.45× base multiplier.</li><li>A loss starts at 0.62× and improves based on how many enemies you defeated.</li><li>Each enemy knockout adds 7 XP and 4 Coins.</li><li>Each surviving friendly Mystic adds 4 XP.</li><li>Campaign first-clear and repeat rewards are added afterward.</li></ul></RuleCard>
            <RuleCard title="Boosts"><p>XP and Coin boosts double their matching calculated battle reward. They do not double campaign first-clear or repeat bonuses.</p><p>Boost duration by rarity: {Object.entries(BOOST_MATCHES).map(([rarity, matches]) => `${rarity} ${matches}`).join(" · ")} matches.</p><p>Activating another boost of the same type adds its duration; the multiplier remains 2×.</p></RuleCard>
          </div>
          <p className="rules-fine-print">Level requirement: 100 XP for level 2, increasing each level. Every level-up grants 100 Coins, or 250 Coins when the new level is divisible by 3.</p>
        </RuleSection>

        <RuleSection id="friends" number="09" icon={<UsersRound />} title="Friends and requests" intro="Friends are tied to Handler profiles and stored with your account.">
          <div className="rules-steps compact">
            <article><b><UserPlus /></b><span><strong>Find a Handler</strong><small>Search using their exact Handler name. Search is normalized for capitalization.</small></span></article>
            <article><b>→</b><span><strong>Send a request</strong><small>You cannot request yourself, duplicate a pending request, or request an existing friend.</small></span></article>
            <article><b><Check /></b><span><strong>Accept or manage</strong><small>Only the recipient can accept. Recipients may decline; senders may cancel; either friend may remove the relationship.</small></span></article>
          </div>
          <div className="rule-callout"><UsersRound /><p>The Friends page separates accepted friends, incoming requests, and sent requests. It refreshes automatically while the page is open.</p></div>
        </RuleSection>

        <section className="rules-finish">
          <WandSparkles />
          <div><span>READY, HANDLER?</span><h2>Build your first formation.</h2><p>You can return to this guide from <strong>How to Play</strong> in the navigation at any time.</p></div>
          <Link className="button primary" href={publicView ? "/" : "/packs"}>{publicView ? "Create or enter account" : "Visit the Vault"}<ArrowRight /></Link>
        </section>
      </main>
    </div>
  </div>;
}
