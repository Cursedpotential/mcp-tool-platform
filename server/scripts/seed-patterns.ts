/**
 * Seed Script: Import Expanded Pattern Library
 * 
 * Surface-level pattern matching for preliminary analysis.
 * MCL linking and detailed analysis happens in meta-analysis phase.
 */

import { getDb } from '../db';
import { behavioralPatterns } from '../../drizzle/schema';

interface PatternSeed {
  name: string;
  category: string;
  pattern: string;
  description: string;
  severity: number;
}

const OWNER_USER_ID = 1;

const patterns: PatternSeed[] = [
  // Gaslighting
  { name: 'Gaslighting: Denial', category: 'gaslighting', pattern: 'i never said that', description: 'Denying previous statements', severity: 8 },
  { name: 'Gaslighting: Imagined', category: 'gaslighting', pattern: 'you imagined', description: 'Suggesting victim fabricated memories', severity: 8 },
  { name: 'Gaslighting: Paranoid', category: 'gaslighting', pattern: "you're paranoid", description: 'Labeling concerns as paranoia', severity: 7 },
  { name: 'Gaslighting: Never Happened', category: 'gaslighting', pattern: 'that never happened', description: 'Denying events', severity: 9 },
  { name: 'Gaslighting: No One Believe', category: 'gaslighting', pattern: 'no one will believe', description: 'Threatening credibility', severity: 9 },
  { name: 'Gaslighting: Crazy', category: 'gaslighting', pattern: "you're crazy", description: 'Questioning sanity', severity: 9 },
  { name: 'Gaslighting: Just High', category: 'gaslighting', pattern: "you're just high", description: 'Blaming substance use', severity: 8 },
  { name: 'Gaslighting: Just Kidding', category: 'gaslighting', pattern: 'just kidding', description: 'Dismissing as joke', severity: 6 },
  { name: 'Gaslighting: Overreacting', category: 'gaslighting', pattern: "you're overreacting", description: 'Invalidating emotions', severity: 7 },
  { name: 'Gaslighting: Drugs Talking', category: 'gaslighting', pattern: 'this is the drugs talking', description: 'Attributing to substances', severity: 8 },

  // Blame Shifting
  { name: 'Blame: Your Fault', category: 'blame_shifting', pattern: 'this is your fault', description: 'Direct blame', severity: 7 },
  { name: 'Blame: You Made Me', category: 'blame_shifting', pattern: 'you made me', description: 'Claiming causation', severity: 8 },
  { name: 'Blame: Because of You', category: 'blame_shifting', pattern: 'because of you', description: 'Attributing outcomes', severity: 7 },
  { name: 'Blame: You Started', category: 'blame_shifting', pattern: 'you started this', description: 'Initiation claim', severity: 6 },
  { name: 'Blame: Always Do This', category: 'blame_shifting', pattern: 'you always do this', description: 'Pattern accusation', severity: 7 },
  { name: 'Blame: If You Hadn\'t', category: 'blame_shifting', pattern: "if you hadn't", description: 'Conditional fault', severity: 7 },
  { name: 'Blame: Made Me Do', category: 'blame_shifting', pattern: 'look what you made me do', description: 'Forced action claim', severity: 9 },

  // Minimizing
  { name: 'Minimizing: Not Big Deal', category: 'minimizing', pattern: 'not a big deal', description: 'Trivializing', severity: 6 },
  { name: 'Minimizing: Too Sensitive', category: 'minimizing', pattern: "you're too sensitive", description: 'Sensitivity attack', severity: 7 },
  { name: 'Minimizing: Calm Down', category: 'minimizing', pattern: 'calm down', description: 'Dismissing emotions', severity: 5 },
  { name: 'Minimizing: Being Dramatic', category: 'minimizing', pattern: "you're being dramatic", description: 'Drama accusation', severity: 6 },
  { name: 'Minimizing: Get Over It', category: 'minimizing', pattern: 'get over it', description: 'Demanding move on', severity: 7 },
  { name: 'Minimizing: Making Scene', category: 'minimizing', pattern: 'stop making a scene', description: 'Scene shaming', severity: 6 },
  { name: 'Minimizing: Just Joke', category: 'minimizing', pattern: 'it was just a joke', description: 'Joke defense', severity: 6 },
  { name: 'Minimizing: Relax', category: 'minimizing', pattern: 'relax', description: 'Dismissal', severity: 5 },

  // Circular Arguments
  { name: 'Circular: What\'s Point', category: 'circular', pattern: 'what even is the point', description: 'Point dismissal', severity: 5 },
  { name: 'Circular: Not The Point', category: 'circular', pattern: "that's not the point", description: 'Point shifting', severity: 6 },
  { name: 'Circular: Keep Changing', category: 'circular', pattern: 'you keep changing', description: 'Changing accusation', severity: 6 },
  { name: 'Circular: Know What I Mean', category: 'circular', pattern: 'you know what i mean', description: 'Vague understanding', severity: 5 },
  { name: 'Circular: Anyway', category: 'circular', pattern: 'anyway', description: 'Termination', severity: 5 },
  { name: 'Circular: Whatever', category: 'circular', pattern: 'whatever', description: 'Dismissal', severity: 5 },
  { name: 'Circular: Not High School', category: 'circular', pattern: "we're not in high school", description: 'Maturity shaming', severity: 6 },

  // DARVO - Deny
  { name: 'DARVO: I Never', category: 'darvo_deny', pattern: 'i never', description: 'Denial', severity: 8 },
  { name: 'DARVO: I Didn\'t', category: 'darvo_deny', pattern: "i didn't", description: 'Denial', severity: 8 },
  { name: 'DARVO: Never Happened', category: 'darvo_deny', pattern: 'that never happened', description: 'Event denial', severity: 9 },
  { name: 'DARVO: Not True', category: 'darvo_deny', pattern: "that's not true", description: 'Truth denial', severity: 8 },
  { name: 'DARVO: Making Up', category: 'darvo_deny', pattern: "you're making that up", description: 'Fabrication accusation', severity: 9 },
  { name: 'DARVO: Would Never', category: 'darvo_deny', pattern: 'i would never', description: 'Character defense', severity: 7 },
  { name: 'DARVO: That\'s Lie', category: 'darvo_deny', pattern: "that's a lie", description: 'Lie accusation', severity: 9 },

  // DARVO - Attack
  { name: 'DARVO: You\'re Crazy', category: 'darvo_attack', pattern: "you're crazy", description: 'Sanity attack', severity: 9 },
  { name: 'DARVO: You\'re Lying', category: 'darvo_attack', pattern: "you're lying", description: 'Liar accusation', severity: 9 },
  { name: 'DARVO: You\'re Abusive', category: 'darvo_attack', pattern: "you're the abusive one", description: 'Abuser projection', severity: 10 },
  { name: 'DARVO: You\'re Manipulating', category: 'darvo_attack', pattern: "you're manipulating", description: 'Manipulation accusation', severity: 9 },
  { name: 'DARVO: You\'re Gaslighting', category: 'darvo_attack', pattern: "you're gaslighting me", description: 'Gaslighting accusation', severity: 10 },
  { name: 'DARVO: You\'re Toxic', category: 'darvo_attack', pattern: "you're toxic", description: 'Toxic label', severity: 9 },
  { name: 'DARVO: You\'re Problem', category: 'darvo_attack', pattern: "you're the problem", description: 'Problem projection', severity: 9 },
  { name: 'DARVO: You\'re Unstable', category: 'darvo_attack', pattern: "you're unstable", description: 'Instability claim', severity: 9 },
  { name: 'DARVO: You\'re Delusional', category: 'darvo_attack', pattern: "you're delusional", description: 'Delusion accusation', severity: 9 },

  // DARVO - Reverse
  { name: 'DARVO: I\'m Victim', category: 'darvo_reverse', pattern: "i'm the victim here", description: 'Victim claim', severity: 10 },
  { name: 'DARVO: You\'re Attacking', category: 'darvo_reverse', pattern: "you're attacking me", description: 'Attack claim', severity: 10 },
  { name: 'DARVO: You\'re Abusing', category: 'darvo_reverse', pattern: "you're abusing me", description: 'Abuse claim', severity: 10 },
  { name: 'DARVO: I\'m Being Hurt', category: 'darvo_reverse', pattern: "i'm the one being hurt", description: 'Hurt claim', severity: 10 },
  { name: 'DARVO: You\'re Hurting', category: 'darvo_reverse', pattern: "you're hurting me", description: 'Hurt accusation', severity: 10 },
  { name: 'DARVO: I\'m Scared', category: 'darvo_reverse', pattern: "i'm scared of you", description: 'Fear claim', severity: 10 },
  { name: 'DARVO: You\'re Aggressor', category: 'darvo_reverse', pattern: "you're the aggressor", description: 'Aggressor label', severity: 10 },
  { name: 'DARVO: Need Protection', category: 'darvo_reverse', pattern: 'i need protection from you', description: 'Protection need', severity: 10 },

  // Overelaboration - Location
  { name: 'Overelaboration: I\'m At', category: 'overelaboration', pattern: "i'm at", description: 'Location reporting', severity: 7 },
  { name: 'Overelaboration: Still At', category: 'overelaboration', pattern: "i'm still at", description: 'Continued presence', severity: 7 },
  { name: 'Overelaboration: Heading To', category: 'overelaboration', pattern: "i'm heading to", description: 'Movement reporting', severity: 7 },
  { name: 'Overelaboration: Will Be At', category: 'overelaboration', pattern: "i'll be at", description: 'Future location', severity: 7 },
  { name: 'Overelaboration: On Way', category: 'overelaboration', pattern: "i'm on my way to", description: 'In-transit', severity: 7 },
  { name: 'Overelaboration: Just Left', category: 'overelaboration', pattern: 'i just left', description: 'Departure', severity: 7 },
  { name: 'Overelaboration: Just Arrived', category: 'overelaboration', pattern: 'i just arrived at', description: 'Arrival', severity: 7 },
  { name: 'Overelaboration: Left At', category: 'overelaboration', pattern: 'i left at', description: 'Departure time', severity: 7 },
  { name: 'Overelaboration: Back By', category: 'overelaboration', pattern: "i'll be back by", description: 'Return time', severity: 7 },
  { name: 'Overelaboration: Been Here Since', category: 'overelaboration', pattern: "i've been here since", description: 'Duration', severity: 7 },
  { name: 'Overelaboration: Done In', category: 'overelaboration', pattern: "i'll be done in", description: 'Completion time', severity: 7 },
  { name: 'Overelaboration: Doing Because', category: 'overelaboration', pattern: "i'm doing this because", description: 'Justification', severity: 8 },
  { name: 'Overelaboration: Had To', category: 'overelaboration', pattern: 'i had to', description: 'Necessity', severity: 8 },
  { name: 'Overelaboration: Needed To', category: 'overelaboration', pattern: 'i needed to', description: 'Need explanation', severity: 8 },
  { name: 'Overelaboration: Reason Is', category: 'overelaboration', pattern: 'the reason is', description: 'Reasoning', severity: 8 },
  { name: 'Overelaboration: I\'m Just', category: 'overelaboration', pattern: "i'm just", description: 'Minimizing justification', severity: 7 },
  { name: 'Overelaboration: Was Just', category: 'overelaboration', pattern: 'i was just', description: 'Past justification', severity: 7 },
  { name: 'Overelaboration: Before You Ask', category: 'overelaboration', pattern: 'before you ask', description: 'Pre-emptive', severity: 8 },
  { name: 'Overelaboration: Know Wondering', category: 'overelaboration', pattern: "i know you're wondering", description: 'Anticipating', severity: 8 },
  { name: 'Overelaboration: Just So Know', category: 'overelaboration', pattern: 'just so you know', description: 'Pre-emptive info', severity: 7 },
  { name: 'Overelaboration: For Record', category: 'overelaboration', pattern: 'for the record', description: 'Documenting', severity: 7 },
  { name: 'Overelaboration: To Be Clear', category: 'overelaboration', pattern: 'to be clear', description: 'Over-clarifying', severity: 7 },

  // Love Bombing
  { name: 'Love Bombing: Perfect', category: 'love_bombing', pattern: 'perfect', description: 'Excessive praise', severity: 5 },
  { name: 'Love Bombing: Amazing', category: 'love_bombing', pattern: 'amazing', description: 'Excessive praise', severity: 5 },
  { name: 'Love Bombing: Soulmate', category: 'love_bombing', pattern: 'soulmate', description: 'Premature commitment', severity: 6 },
  { name: 'Love Bombing: Can\'t Live Without', category: 'love_bombing', pattern: "can't live without you", description: 'Dependency claim', severity: 7 },
  { name: 'Love Bombing: Always', category: 'love_bombing', pattern: 'always', description: 'Forever promise', severity: 5 },
  { name: 'Love Bombing: Forever', category: 'love_bombing', pattern: 'forever', description: 'Forever promise', severity: 5 },
  { name: 'Love Bombing: Everything', category: 'love_bombing', pattern: 'everything', description: 'Totality claim', severity: 5 },
  { name: 'Love Bombing: Desperate', category: 'love_bombing', pattern: 'desperate', description: 'Intensity', severity: 6 },
  { name: 'Love Bombing: Need You', category: 'love_bombing', pattern: 'need you', description: 'Dependency', severity: 6 },
  { name: 'Love Bombing: Only One Understands', category: 'love_bombing', pattern: "you're the only one who understands me", description: 'Unique understanding', severity: 6 },
  { name: 'Love Bombing: Never Felt This Way', category: 'love_bombing', pattern: "i've never felt this way before", description: 'Uniqueness claim', severity: 6 },
  { name: 'Love Bombing: Give Everything', category: 'love_bombing', pattern: 'i want to give you everything', description: 'Grand promise', severity: 6 },

  // Excessive Gratitude
  { name: 'Gratitude: Owe Everything', category: 'excessive_gratitude', pattern: 'i owe you everything', description: 'Creating obligation', severity: 6 },
  { name: 'Gratitude: Never Repay', category: 'excessive_gratitude', pattern: 'i could never repay you', description: 'Unpayable debt', severity: 6 },
  { name: 'Gratitude: Don\'t Deserve', category: 'excessive_gratitude', pattern: "i don't deserve you", description: 'False humility', severity: 5 },
  { name: 'Gratitude: Done So Much', category: 'excessive_gratitude', pattern: "you've done so much for me", description: 'Emphasizing contributions', severity: 5 },
  { name: 'Gratitude: So Grateful', category: 'excessive_gratitude', pattern: "i'm so grateful", description: 'Excessive gratitude', severity: 4 },
  { name: 'Gratitude: Thank Everything', category: 'excessive_gratitude', pattern: 'thank you for everything', description: 'Blanket gratitude', severity: 4 },
  { name: 'Gratitude: What Would I Do', category: 'excessive_gratitude', pattern: "i don't know what i'd do without you", description: 'Dependency', severity: 6 },
  { name: 'Gratitude: Saved Me', category: 'excessive_gratitude', pattern: 'you saved me', description: 'Savior positioning', severity: 7 },
  { name: 'Gratitude: Owe Life', category: 'excessive_gratitude', pattern: 'i owe you my life', description: 'Extreme debt', severity: 7 },

  // Debt Reminders
  { name: 'Debt: Remember When', category: 'debt_reminders', pattern: 'remember when i', description: 'Past favor reminder', severity: 7 },
  { name: 'Debt: After All Done', category: 'debt_reminders', pattern: "after all i've done", description: 'Leveraging past', severity: 8 },
  { name: 'Debt: Was There', category: 'debt_reminders', pattern: 'i was there for you when', description: 'Support reminder', severity: 7 },
  { name: 'Debt: Don\'t Forget', category: 'debt_reminders', pattern: "don't forget i", description: 'Ensuring memory', severity: 7 },
  { name: 'Debt: I Helped', category: 'debt_reminders', pattern: 'i helped you', description: 'Assistance reminder', severity: 6 },
  { name: 'Debt: I Gave', category: 'debt_reminders', pattern: 'i gave you', description: 'Gift reminder', severity: 6 },

  // Savior Complex
  { name: 'Savior: Protect You', category: 'savior_complex', pattern: "i'll protect you", description: 'Protector positioning', severity: 7 },
  { name: 'Savior: Keep Safe', category: 'savior_complex', pattern: "i'll keep you safe", description: 'Safety promise', severity: 7 },
  { name: 'Savior: Won\'t Let Hurt', category: 'savior_complex', pattern: "i won't let anyone hurt you", description: 'Protection claim', severity: 7 },
  { name: 'Savior: You Need Me', category: 'savior_complex', pattern: 'you need me', description: 'Dependency claim', severity: 8 },
  { name: 'Savior: Take Care', category: 'savior_complex', pattern: "i'll take care of you", description: 'Caretaking promise', severity: 6 },
  { name: 'Savior: Fix This', category: 'savior_complex', pattern: "i'll fix this", description: 'Problem-solver', severity: 6 },
  { name: 'Savior: Let Me Handle', category: 'savior_complex', pattern: 'let me handle it', description: 'Control taking', severity: 6 },
  { name: 'Savior: Make Better', category: 'savior_complex', pattern: "i'll make it better", description: 'Solution promise', severity: 5 },
  { name: 'Savior: Trust To Protect', category: 'savior_complex', pattern: 'trust me to protect you', description: 'Trust demand', severity: 7 },
  { name: 'Savior: Everyone Else Hurt', category: 'savior_complex', pattern: 'everyone else will hurt you', description: 'World as dangerous', severity: 9 },
  { name: 'Savior: World Dangerous', category: 'savior_complex', pattern: 'the world is dangerous', description: 'Fear creation', severity: 8 },
  { name: 'Savior: Can\'t Trust Anyone', category: 'savior_complex', pattern: "you can't trust anyone but me", description: 'Trust destruction', severity: 9 },
  { name: 'Savior: Out To Get', category: 'savior_complex', pattern: "they're all out to get you", description: 'Paranoia creation', severity: 9 },
  { name: 'Savior: Only One Cares', category: 'savior_complex', pattern: "i'm the only one who cares", description: 'Exclusive care', severity: 8 },

  // Substance - Alcohol
  { name: 'Substance: Drink', category: 'substance_alcohol', pattern: 'drink', description: 'Alcohol mention', severity: 0 },
  { name: 'Substance: Drank', category: 'substance_alcohol', pattern: 'drank', description: 'Alcohol mention', severity: 0 },
  { name: 'Substance: Drunk', category: 'substance_alcohol', pattern: 'drunk', description: 'Intoxication', severity: 0 },
  { name: 'Substance: Buzzed', category: 'substance_alcohol', pattern: 'buzzed', description: 'Intoxication', severity: 0 },
  { name: 'Substance: Tipsy', category: 'substance_alcohol', pattern: 'tipsy', description: 'Intoxication', severity: 0 },
  { name: 'Substance: Wasted', category: 'substance_alcohol', pattern: 'wasted', description: 'Intoxication', severity: 0 },
  { name: 'Substance: Bottle', category: 'substance_alcohol', pattern: 'bottle', description: 'Alcohol container', severity: 0 },
  { name: 'Substance: Wine', category: 'substance_alcohol', pattern: 'wine', description: 'Alcohol type', severity: 0 },
  { name: 'Substance: Beer', category: 'substance_alcohol', pattern: 'beer', description: 'Alcohol type', severity: 0 },
  { name: 'Substance: Liquor', category: 'substance_alcohol', pattern: 'liquor', description: 'Alcohol type', severity: 0 },
  { name: 'Substance: Vodka', category: 'substance_alcohol', pattern: 'vodka', description: 'Alcohol type', severity: 0 },
  { name: 'Substance: Tequila', category: 'substance_alcohol', pattern: 'tequila', description: 'Alcohol type', severity: 0 },
  { name: 'Substance: Hungover', category: 'substance_alcohol', pattern: 'hungover', description: 'After-effects', severity: 0 },
  { name: 'Substance: Fireball', category: 'substance_alcohol', pattern: 'fireball', description: 'Alcohol brand', severity: 0 },

  // Substance - Weaponized
  { name: 'Substance Weapon: Crackhead', category: 'substance_weaponized', pattern: 'crackhead', description: 'Drug slur', severity: 9 },
  { name: 'Substance Weapon: Tweaker', category: 'substance_weaponized', pattern: 'tweaker', description: 'Drug slur', severity: 9 },
  { name: 'Substance Weapon: Addict', category: 'substance_weaponized', pattern: 'addict', description: 'Drug label', severity: 8 },
  { name: 'Substance Weapon: Junkie', category: 'substance_weaponized', pattern: 'junkie', description: 'Drug slur', severity: 9 },
  { name: 'Substance Weapon: User', category: 'substance_weaponized', pattern: 'user', description: 'Drug label', severity: 7 },
  { name: 'Substance Weapon: Just High', category: 'substance_weaponized', pattern: "you're just high", description: 'Invalidation', severity: 8 },
  { name: 'Substance Weapon: On Something', category: 'substance_weaponized', pattern: 'are you on something', description: 'Accusation', severity: 8 },
  { name: 'Substance Weapon: Drugs Talking', category: 'substance_weaponized', pattern: 'this is the drugs talking', description: 'Invalidation', severity: 8 },

  // Adderall Control
  { name: 'Adderall: Adderall', category: 'adderall_control', pattern: 'adderall', description: 'Medication mention', severity: 7 },
  { name: 'Adderall: Addy', category: 'adderall_control', pattern: 'addy', description: 'Medication slang', severity: 7 },
  { name: 'Adderall: Pills', category: 'adderall_control', pattern: 'pills', description: 'Medication generic', severity: 6 },
  { name: 'Adderall: Script', category: 'adderall_control', pattern: 'script', description: 'Prescription', severity: 6 },
  { name: 'Adderall: Share', category: 'adderall_control', pattern: 'share', description: 'Medication sharing', severity: 7 },
  { name: 'Adderall: Split', category: 'adderall_control', pattern: 'split', description: 'Medication splitting', severity: 7 },
  { name: 'Adderall: Your Turn', category: 'adderall_control', pattern: 'your turn', description: 'Medication rationing', severity: 8 },
  { name: 'Adderall: How Many', category: 'adderall_control', pattern: 'how many did you take', description: 'Medication monitoring', severity: 8 },
  { name: 'Adderall: Holding For You', category: 'adderall_control', pattern: "i'm holding onto them for you", description: 'Medication control', severity: 9 },
  { name: 'Adderall: Can\'t Control', category: 'adderall_control', pattern: "you can't control yourself", description: 'Control justification', severity: 9 },

  // Infidelity - Places
  { name: 'Infidelity Place: Huckleberry', category: 'infidelity_places', pattern: 'huckleberry junction', description: 'Specific location', severity: 0 },
  { name: 'Infidelity Place: Hucks', category: 'infidelity_places', pattern: "huck's", description: 'Specific location', severity: 0 },
  { name: 'Infidelity Place: Hucks2', category: 'infidelity_places', pattern: 'hucks', description: 'Specific location', severity: 0 },

  // Infidelity - General
  { name: 'Infidelity: Cheating', category: 'infidelity', pattern: 'cheating', description: 'Infidelity mention', severity: 8 },
  { name: 'Infidelity: Cheated', category: 'infidelity', pattern: 'cheated', description: 'Infidelity past', severity: 8 },
  { name: 'Infidelity: Slept With', category: 'infidelity', pattern: 'slept with', description: 'Sexual involvement', severity: 8 },
  { name: 'Infidelity: Affair', category: 'infidelity', pattern: 'affair', description: 'Relationship betrayal', severity: 9 },
  { name: 'Infidelity: Secret', category: 'infidelity', pattern: 'secret', description: 'Hidden behavior', severity: 6 },
  { name: 'Infidelity: Seeing Someone', category: 'infidelity', pattern: 'seeing someone', description: 'Other relationship', severity: 8 },
  { name: 'Infidelity: Loyal', category: 'infidelity', pattern: 'loyal', description: 'Loyalty claim', severity: 5 },
  { name: 'Infidelity: Faithful', category: 'infidelity', pattern: 'faithful', description: 'Faithfulness claim', severity: 5 },
  { name: 'Infidelity: Just Friend', category: 'infidelity', pattern: "he's just a friend", description: 'Denial', severity: 6 },
  { name: 'Infidelity: Just Work', category: 'infidelity', pattern: 'we just work together', description: 'Denial', severity: 6 },
  { name: 'Infidelity: Being Jealous', category: 'infidelity', pattern: "you're being jealous", description: 'Invalidation', severity: 7 },
  { name: 'Infidelity: Don\'t Trust', category: 'infidelity', pattern: "why don't you trust me", description: 'Trust questioning', severity: 7 },

  // Financial - Weaponized
  { name: 'Financial Weapon: Don\'t Do Anything', category: 'financial_weaponized', pattern: "you don't do anything", description: 'Contribution attack', severity: 8 },
  { name: 'Financial Weapon: I Work Hard', category: 'financial_weaponized', pattern: "i'm the one who works hard", description: 'Effort comparison', severity: 7 },
  { name: 'Financial Weapon: What Do I Get', category: 'financial_weaponized', pattern: 'what do i get out of this', description: 'Transactional', severity: 8 },
  { name: 'Financial Weapon: Your Responsibility', category: 'financial_weaponized', pattern: "it's your responsibility to provide", description: 'Obligation claim', severity: 8 },

  // Sexual Shaming
  { name: 'Sexual Shame: Slut', category: 'sexual_shaming', pattern: 'slut', description: 'Sexual slur', severity: 10 },
  { name: 'Sexual Shame: Whore', category: 'sexual_shaming', pattern: 'whore', description: 'Sexual slur', severity: 10 },
  { name: 'Sexual Shame: Pervert', category: 'sexual_shaming', pattern: 'pervert', description: 'Sexual slur', severity: 9 },
  { name: 'Sexual Shame: Disgusting', category: 'sexual_shaming', pattern: 'disgusting', description: 'Degradation', severity: 8 },
  { name: 'Sexual Shame: Sick', category: 'sexual_shaming', pattern: 'sick', description: 'Degradation', severity: 8 },
  { name: 'Sexual Shame: Nasty', category: 'sexual_shaming', pattern: 'nasty', description: 'Degradation', severity: 8 },
  { name: 'Sexual Shame: Freak', category: 'sexual_shaming', pattern: 'freak', description: 'Sexual slur', severity: 9 },
  { name: 'Sexual Shame: Used', category: 'sexual_shaming', pattern: 'used', description: 'Degradation', severity: 9 },
  { name: 'Sexual Shame: Cheap', category: 'sexual_shaming', pattern: 'cheap', description: 'Degradation', severity: 8 },
  { name: 'Sexual Shame: Everyone Leaves', category: 'sexual_shaming', pattern: 'no wonder everyone leaves you', description: 'Abandonment threat', severity: 10 },
  { name: 'Sexual Shame: To Think', category: 'sexual_shaming', pattern: 'to think i ever did', description: 'Regret expression', severity: 9 },

  // Parental Alienation
  { name: 'Alienation: Doesn\'t Want See', category: 'parental_alienation', pattern: "doesn't want to see you", description: 'Child rejection claim', severity: 10 },
  { name: 'Alienation: Protect From You', category: 'parental_alienation', pattern: 'i have to protect the children from you', description: 'Protection justification', severity: 10 },
  { name: 'Alienation: Kailah', category: 'parental_alienation', pattern: 'kailah', description: 'Child name mention', severity: 10 },
  { name: 'Alienation: Kyla', category: 'parental_alienation', pattern: 'kyla', description: 'Child name variant', severity: 10 },
  { name: 'Alienation: My Daughter', category: 'parental_alienation', pattern: 'my daughter', description: 'Possessive child reference', severity: 8 },
  { name: 'Alienation: Our Daughter', category: 'parental_alienation', pattern: 'our daughter', description: 'Child reference', severity: 7 },
  { name: 'Alienation: The Baby', category: 'parental_alienation', pattern: 'the baby', description: 'Child reference', severity: 6 },
  { name: 'Alienation: The Kid', category: 'parental_alienation', pattern: 'the kid', description: 'Child reference', severity: 6 },

  // Medical Abuse
  { name: 'Medical: Need Meds', category: 'medical_abuse', pattern: 'you need your meds', description: 'Medication control', severity: 9 },
  { name: 'Medical: Take Pills', category: 'medical_abuse', pattern: 'did you take your pills', description: 'Medication monitoring', severity: 8 },
  { name: 'Medical: Not Thinking Clearly', category: 'medical_abuse', pattern: "you're not thinking clearly", description: 'Cognitive invalidation', severity: 9 },
  { name: 'Medical: Medication Talking', category: 'medical_abuse', pattern: "it's the medication talking", description: 'Invalidation', severity: 9 },
  { name: 'Medical: Can\'t Make Decisions', category: 'medical_abuse', pattern: "you can't make decisions", description: 'Capacity denial', severity: 10 },
  { name: 'Medical: Not Well Enough', category: 'medical_abuse', pattern: "you're not well enough", description: 'Health gatekeeping', severity: 9 },
  { name: 'Medical: Holding Meds', category: 'medical_abuse', pattern: "i'm holding your meds", description: 'Medication control', severity: 10 },
  { name: 'Medical: Can\'t Be Trusted', category: 'medical_abuse', pattern: "you can't be trusted with", description: 'Trust denial', severity: 9 },
  { name: 'Medical: Bipolar', category: 'medical_abuse', pattern: "you're bipolar", description: 'Diagnosis weaponization', severity: 9 },
  { name: 'Medical: Borderline', category: 'medical_abuse', pattern: "you're borderline", description: 'Diagnosis weaponization', severity: 9 },
  { name: 'Medical: Schizophrenic', category: 'medical_abuse', pattern: "you're schizophrenic", description: 'Diagnosis weaponization', severity: 9 },
  { name: 'Medical: Condition Talking', category: 'medical_abuse', pattern: "that's your [condition] talking", description: 'Invalidation', severity: 9 },
  { name: 'Medical: Having Episode', category: 'medical_abuse', pattern: "you're having an episode", description: 'Crisis claim', severity: 9 },
  { name: 'Medical: Need Hospitalized', category: 'medical_abuse', pattern: 'you need to be hospitalized', description: 'Institutionalization threat', severity: 10 },
  { name: 'Medical: Unstable', category: 'medical_abuse', pattern: "you're unstable", description: 'Mental health attack', severity: 9 },

  // Reproductive Coercion
  { name: 'Reproductive: Want Pregnant', category: 'reproductive_coercion', pattern: 'i want you pregnant', description: 'Pregnancy demand', severity: 10 },
  { name: 'Reproductive: Should Get Pregnant', category: 'reproductive_coercion', pattern: 'you should get pregnant', description: 'Pregnancy pressure', severity: 10 },
  { name: 'Reproductive: Stop Birth Control', category: 'reproductive_coercion', pattern: 'stop taking birth control', description: 'Contraception interference', severity: 10 },
  { name: 'Reproductive: Get You Pregnant', category: 'reproductive_coercion', pattern: "i'll get you pregnant", description: 'Pregnancy threat', severity: 10 },
  { name: 'Reproductive: Can\'t Leave Pregnant', category: 'reproductive_coercion', pattern: "you can't leave if you're pregnant", description: 'Pregnancy as trap', severity: 10 },
  { name: 'Reproductive: Baby Fix', category: 'reproductive_coercion', pattern: 'a baby will fix us', description: 'Baby as solution', severity: 9 },
  { name: 'Reproductive: Owe Child', category: 'reproductive_coercion', pattern: 'you owe me a child', description: 'Child as debt', severity: 10 },
  { name: 'Reproductive: Sabotaged', category: 'reproductive_coercion', pattern: 'i sabotaged your birth control', description: 'Contraception sabotage', severity: 10 },
  { name: 'Reproductive: Take Baby', category: 'reproductive_coercion', pattern: "i'll take the baby", description: 'Custody threat', severity: 10 },
  { name: 'Reproductive: Never See Baby', category: 'reproductive_coercion', pattern: "you'll never see the baby", description: 'Access threat', severity: 10 },
  { name: 'Reproductive: Prove Unfit', category: 'reproductive_coercion', pattern: "i'll prove you're unfit", description: 'Fitness attack', severity: 10 },
  { name: 'Reproductive: Bad Mother', category: 'reproductive_coercion', pattern: "you're a bad mother", description: 'Parenting attack', severity: 9 },
  { name: 'Reproductive: Baby Doesn\'t Need', category: 'reproductive_coercion', pattern: "the baby doesn't need you", description: 'Necessity denial', severity: 10 },

  // Power Asymmetry - Victim Deference
  { name: 'Deference: If Okay', category: 'victim_deference', pattern: "if that's okay", description: 'Permission seeking', severity: 7 },
  { name: 'Deference: If Don\'t Mind', category: 'victim_deference', pattern: "if you don't mind", description: 'Permission seeking', severity: 7 },
  { name: 'Deference: Is Alright', category: 'victim_deference', pattern: 'is that alright', description: 'Approval seeking', severity: 7 },
  { name: 'Deference: Sorry', category: 'victim_deference', pattern: 'sorry', description: 'Apologetic', severity: 6 },
  { name: 'Deference: My Bad', category: 'victim_deference', pattern: 'my bad', description: 'Apologetic', severity: 6 },
  { name: 'Deference: Didn\'t Mean', category: 'victim_deference', pattern: "i didn't mean to", description: 'Apologetic', severity: 6 },
  { name: 'Deference: I Apologize', category: 'victim_deference', pattern: 'i apologize', description: 'Apologetic', severity: 6 },
  { name: 'Deference: Hope Fine', category: 'victim_deference', pattern: "i hope that's fine", description: 'Approval seeking', severity: 7 },
  { name: 'Deference: Let Me Know', category: 'victim_deference', pattern: 'let me know if', description: 'Deferential', severity: 6 },

  // Power Asymmetry - Abuser Directives
  { name: 'Directive: Where Are You', category: 'abuser_directives', pattern: 'where are you', description: 'Location demand', severity: 8 },
  { name: 'Directive: What Doing', category: 'abuser_directives', pattern: 'what are you doing', description: 'Activity demand', severity: 8 },
  { name: 'Directive: Who With', category: 'abuser_directives', pattern: 'who are you with', description: 'Company demand', severity: 8 },
  { name: 'Directive: Come Here', category: 'abuser_directives', pattern: 'come here', description: 'Movement command', severity: 7 },
  { name: 'Directive: Go There', category: 'abuser_directives', pattern: 'go there', description: 'Movement command', severity: 7 },
  { name: 'Directive: Do This', category: 'abuser_directives', pattern: 'do this', description: 'Action command', severity: 7 },
  { name: 'Directive: Stop That', category: 'abuser_directives', pattern: 'stop that', description: 'Prohibition command', severity: 7 },
  { name: 'Directive: Tell Me', category: 'abuser_directives', pattern: 'tell me', description: 'Information demand', severity: 7 },
  { name: 'Directive: Show Me', category: 'abuser_directives', pattern: 'show me', description: 'Proof demand', severity: 8 },
  { name: 'Directive: Prove It', category: 'abuser_directives', pattern: 'prove it', description: 'Evidence demand', severity: 8 },

  // Statistical Markers - Certainty
  { name: 'Certainty: Always', category: 'certainty_absolutes', pattern: 'always', description: 'Absolute claim', severity: 0 },
  { name: 'Certainty: Never', category: 'certainty_absolutes', pattern: 'never', description: 'Absolute claim', severity: 0 },
  { name: 'Certainty: Nothing', category: 'certainty_absolutes', pattern: 'nothing', description: 'Absolute claim', severity: 0 },
  { name: 'Certainty: Everything', category: 'certainty_absolutes', pattern: 'everything', description: 'Absolute claim', severity: 0 },
  { name: 'Certainty: Everyone', category: 'certainty_absolutes', pattern: 'everyone', description: 'Absolute claim', severity: 0 },
  { name: 'Certainty: Nobody', category: 'certainty_absolutes', pattern: 'nobody', description: 'Absolute claim', severity: 0 },
  { name: 'Certainty: Fact', category: 'certainty_absolutes', pattern: 'fact', description: 'Certainty marker', severity: 0 },
  { name: 'Certainty: Obviously', category: 'certainty_absolutes', pattern: 'obviously', description: 'Certainty marker', severity: 0 },
  { name: 'Certainty: Clearly', category: 'certainty_absolutes', pattern: 'clearly', description: 'Certainty marker', severity: 0 },
  { name: 'Certainty: Literally', category: 'certainty_absolutes', pattern: 'literally', description: 'Certainty marker', severity: 0 },

  // Statistical Markers - Hedge Words
  { name: 'Hedge: Maybe', category: 'hedge_words', pattern: 'maybe', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Perhaps', category: 'hedge_words', pattern: 'perhaps', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Possibly', category: 'hedge_words', pattern: 'possibly', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Might', category: 'hedge_words', pattern: 'might', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Could', category: 'hedge_words', pattern: 'could', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: I Think', category: 'hedge_words', pattern: 'i think', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: I Guess', category: 'hedge_words', pattern: 'i guess', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Sort Of', category: 'hedge_words', pattern: 'sort of', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Kind Of', category: 'hedge_words', pattern: 'kind of', description: 'Uncertainty marker', severity: 0 },
  { name: 'Hedge: Probably', category: 'hedge_words', pattern: 'probably', description: 'Uncertainty marker', severity: 0 },
];

export async function seedPatterns() {
  console.log('🌱 Seeding behavioral patterns...');
  console.log(`📝 Total patterns to import: ${patterns.length}`);
  
  try {
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db.insert(behavioralPatterns).values(
        batch.map(p => ({
          userId: OWNER_USER_ID,
          name: p.name,
          category: p.category,
          pattern: p.pattern,
          description: p.description,
          severity: p.severity,
          mclFactors: JSON.stringify([]), // Empty for now, meta-analysis will populate
          examples: JSON.stringify([]), // Empty for now
          isActive: 'true' as const,
          isCustom: 'true' as const,
          matchCount: 0,
        }))
      );
      
      totalInserted += batch.length;
      console.log(`  ✓ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} patterns (${totalInserted}/${patterns.length})`);
    }
    
    console.log(`\n✅ Successfully seeded ${totalInserted} patterns`);
    
    // Summary by category
    const categories = new Set(patterns.map(p => p.category));
    console.log('\n📊 Pattern Summary by Category:');
    for (const category of Array.from(categories)) {
      const count = patterns.filter(p => p.category === category).length;
      console.log(`  ${category}: ${count} patterns`);
    }
    
  } catch (error) {
    console.error('❌ Error seeding patterns:', error);
    throw error;
  }
}

// Run if called directly
seedPatterns()
  .then(() => {
    console.log('\n✅ Pattern seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Pattern seeding failed:', error);
    process.exit(1);
  });
