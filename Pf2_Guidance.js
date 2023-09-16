var Guidance = Guidance || (function () {
    "use strict";

    const guidanceWelcome = "";
    const guidanceGreeting = "Greetings, I am Guidance. I am here to assist you working with your game. " +
        "To learn more, I created a welcome guide in the journal section.";

    const debugMode = true;

    // commands
    const prefix = "!sf_";
    const commandDebug = prefix + "debug";
    const commandHelp = prefix + "help";
    const commandToken = prefix + "token";
    const commandClean = prefix + "clean";
    const commandPopulate = prefix + "npc";

    //<editor-fold desc="Support Methods">
    let firstMatch = function (source, regex, ignoreEmpty) {
        let match = source.match(regex);
        if (match == null || match.length === 0 || match[0] == null || !Array.isArray(match)) {
            debugLog("firstItem: Not a valid array of strings");
            if (ignoreEmpty == undefined) {
                return "";
            }
            return source;
        }
        return match[0].trim();
    }

    let substringFrom = function (source, delimit) {
        let index = source.toLowerCase().indexOf(delimit.toLowerCase());
        if (index === -1) {
            return "";
        }
        return source.substr(index + delimit.length);
    }

    /// Class that represents a NPC/Starship that is being worked on.
    class NPC {
        constructor(characterId, token, characterSheet) {
            this.characterId = characterId;
            this.npcToken = token;
            this.characterSheet = characterSheet;
        }
    }

    // Based on code from https://app.roll20.net/users/104025/the-aaron
    let generateUUID = (function () {
        let lastTimestamp = 0;
        let randomValues = [];

        return function () {
            let currentTimestamp = (new Date()).getTime();
            let duplicateTimestamp = currentTimestamp === lastTimestamp;
            lastTimestamp = currentTimestamp;

            let uuidArray = new Array(8);
            for (let i = 7; i >= 0; i--) {
                uuidArray[i] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(currentTimestamp % 64);
                currentTimestamp = Math.floor(currentTimestamp / 64);
            }

            let uuid = uuidArray.join("");

            if (duplicateTimestamp) {
                for (let i = 11; i >= 0 && randomValues[i] === 63; i--) {
                    randomValues[i] = 0;
                }
                randomValues[i]++;
            } else {
                for (let i = 0; i < 12; i++) {
                    randomValues[i] = Math.floor(64 * Math.random());
                }
            }

            for (let i = 0; i < 12; i++) {
                uuid += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(randomValues[i]);
            }

            return uuid;
        };
    })();

    let generateRowID = function () {
        return generateUUID().replace(/_/g, "Z");
    };

    let debugLog = function (text) {
        let timestamp = new Date().toUTCString();
        let stackTrace = new Error().stack.split("\n");
        log(`${timestamp} ${stackTrace[2].trim()} ${text}`);
    };

    let getAttribute = function (characterId, attributeName) {
        return findObjs({
            _characterid: characterId,
            _type: "attribute",
            name: attributeName
        })[0];
    };

    let debugCharacterDetails = function (character) {
        let attributes = findObjs({
            _characterid: character.characterId,
            _type: "attribute",
        });
        for (const att of attributes) {
            log("{\"name\":" + att.get("name") + "\"," +
                "\"current\":\"" + att.get("current") + "\"," +
                "\"max\":\"" + att.get("max") + "\"}");
        }

        let abilities = findObjs({
            _characterid: character.characterId,
            _type: "ability",
        });
        for (const ab of abilities) {
            debugLog(ab.get("name"));
        }
    };

    // borrowed from https://app.roll20.net/users/901082/invincible-spleen in the forums
    let setAttribute = function (characterId, attributeName, newValue, operator) {
        if (!attributeName || !newValue) {
            return;
        }

        let foundAttribute = getAttribute(characterId, attributeName);
        let mod_newValue = {
            "+": function (num) {
                return num;
            },
            "-": function (num) {
                return -num;
            }
        };

        try {
            if (!foundAttribute) {
                if (typeof operator !== "undefined" && !isNaN(newValue)) {
                    newValue = mod_newValue[operator](newValue);
                }

                if (attributeName.includes("show")) {
                    return;
                }

                if (newValue === undefined || newValue === "" || newValue === 0) {
                    return;
                }

                createObj("attribute", {
                    name: attributeName,
                    current: newValue,
                    max: newValue,
                    _characterid: characterId
                });
                //    debugLog("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterId + " with a value of " + newValue + ".");
            } else {
                if (typeof operator !== "undefined" && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }

                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
                //     debugLog("DefaultAttributes: Setting " + attributeName + " on character ID " + characterId + " to a value of " + newValue + ".");
            }
        } catch (err) {
            debugLog(err);
            debugLog(new Error().stack);
        }
    };

    let getSelectedNPCs = function (selected) {
        let npcs = [];
        for (const t of selected) {
            debugLog(t + "adding");
            let token = findObjs(t)[0];
            let cid = token.get("represents");
            npcs.push(new NPC(cid, token, findObjs({_id: cid, _type: "character"})[0]));
        }
        return npcs;
    };

    let speakAsGuidanceToGM = function (text) {
        text = "/w gm  &{template:default} {{name=Guidance}} {{" + text + "}}";
        sendChat("Guidance", text);
    };

    let toTitleCase = function (str) {
        str = str.toLowerCase().split(' ');
        for (let i = 0; i < str.length; i++) {
            str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
        }
        return str.join(' ');
    }

    let cleanText = function (textToClean) {
        return textToClean
            .replaceAll("</p>", "~")
            .replaceAll("<br", "~<br")
            .replace(/(<([^>]+)>)/gi, " ")
            .replace(/&nbsp;|&amp;/gi, " ")
            .replace(/\s+/g, " ");
    };

    // For Debugging purposes
    let isNullOrUndefined = function (v) {
        if (v == null) { // null or undefined
            debugLog(v === null ? "null" : "undefined");
            debugLog(new Error().stack);
            return true;
        }
        return false;
    };
    //</editor-fold>

    //<editor-fold desc="on(ready) event">
    on("ready", function () {
        speakAsGuidanceToGM(guidanceGreeting);

        let handoutName = "Welcome To Guidance";
        let objs = findObjs({name: handoutName, _type: "handout"});
        let userGuide;
        if (objs.length < 1) {
            userGuide = createObj("handout", {
                name: handoutName
            });
        } else {
            userGuide = objs[0];
        }
        userGuide.set("notes", guidanceWelcome);
    });
    //</editor-fold>

    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        let chatAPICommand = chatMessage.content;

        if (chatMessage.selected === undefined) {
            speakAsGuidanceToGM("Please select a token representing a character for me to work with");
            return;
        }

        let selectedNPCs = getSelectedNPCs(chatMessage.selected);

        if (debugMode) {
            debugLog(chatAPICommand);
        }

        try {
            //<editor-fold desc="commandHelp - Show Help information for using Guidance">
            if (chatAPICommand.startsWith(commandHelp)) {
                speakAsGuidanceToGM(guidanceWelcome);
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandClean - Erase All Information on a character sheet">
            if (chatAPICommand.startsWith(commandClean)) {
                if (selectedNPCs.length > 1) {
                    speakAsGuidanceToGM("Please do not select more than 1 NPC at a time. This command is potentially dangerous.");
                    return;
                }
                let selectedNPC = selectedNPCs[0];
                if (chatAPICommand.includes("CONFIRM")) {
                    eraseCharacter(selectedNPC);
                } else {
                    speakAsGuidanceToGM("Check usage for !sf_clean");
                }
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandDebug - Show Debug information for character linked to Token">
            if (chatAPICommand.startsWith(commandDebug)) {
                selectedNPCs.forEach(debugCharacterDetails);

                let macros = findObjs({
                    _type: "macro",
                });
                for (const ab of macros) {
                    debugLog(ab.get("name"));
                    debugLog(ab.get("action"));
                }
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandToken - Configure Token linked to Sheet">
            if (chatAPICommand.startsWith(commandToken)) {
                selectedNPCs.forEach(configureToken);
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandPopulate - Populate NPC Character Sheet">
            if (chatAPICommand.startsWith(commandPopulate)) {
                selectedNPCs.forEach(function (c) {
                    c.characterSheet.get("gmnotes", function (gmNotes) {
                        if (!gmNotes.includes("Will")
                            && !gmNotes.includes("Fort")
                            && !gmNotes.includes("Ref")) {
                            speakAsGuidanceToGM("This does not appear to be a character statblock");
                            return;
                        }
                        populateCharacterSheet(gmNotes, c);
                        configureToken(c);
                    });
                });
                return;
            }
            //</editor-fold>

        } catch (err) {
            speakAsGuidanceToGM("I have encountered an error. If you can, please report this to the Script Creator.");
            debugLog(err);
            debugLog(new Error().stack);
        }
    });

    function populateStat(characterId, statBlock, regex, ...stats) {
        let current = firstMatch(statBlock, regex);

        if (current === "") {
            return statBlock;
        }
        current = current.trim().replaceAll("~", "").trim();

        if (Array.isArray(stats)) {
            stats.forEach(stat => {
                setAttribute(characterId, stat, current);
            });
        } else {
            setAttribute(characterId, stats, current);
        }

        statBlock = substringFrom(statBlock, current).trim();
        statBlock = removeLeadingDelimiters(statBlock);
        return statBlock;
    }

    function removeLeadingDelimiters(source) {
        source = source.trim();
        if (source.startsWith(";")) {
            source = substringFrom(source, ";").trim();
        }
        if (source.startsWith("~")) {
            source = substringFrom(source, "~").trim();
        }
        return source;
    }

    let populateCharacterSheet = function (gmNotes, selectedNPC) {
        try {
            let characterId = selectedNPC.characterId;
            let npcToken = selectedNPC.npcToken;
            let characterSheet = selectedNPC.characterSheet;
            let statBlock = cleanText(gmNotes);

            npcToken.set("gmnotes", statBlock);
            setAttribute(characterId, "npc_type", "Creature");
            setAttribute(characterId, "sheet_type", "npc");

            let current = firstMatch(statBlock, /.*?(?=(Creature|Level).*\d+)/im);
            characterSheet.set("name", toTitleCase(current));
            npcToken.set("name", toTitleCase(current));
            let npcName = toTitleCase(current);

            statBlock = populateStat(characterId, statBlock, /(?<=(Creature|Level)\s+).+?(?=~|\s+)/si, "level");
            statBlock = populateStat(characterId, statBlock, /(?<=.*)(LG|NG|CG|LN|N|CN|LE|NE|CE)(?=\s+)/s, "alignment");
            statBlock = populateStat(characterId, statBlock, /(?<=.*)(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)(?=\s+)/si, "size");
            statBlock = populateStat(characterId, statBlock, /.*?(?=Source|Perception)/s, "traits");
            statBlock = populateStat(characterId, statBlock, /.*?(?=Perception)/s, "source");
            statBlock = populateStat(characterId, statBlock, /(?<=.*Perception).*?(?=;)/s, "npc_perception", "perception");
            statBlock = populateStat(characterId, statBlock, /.*?(?=~|Skills|Languages)/s, "senses");
            statBlock = populateStat(characterId, statBlock, /(?<=Languages).*?(?=Skills|~)/s, "languages");
            statBlock = substringFrom(statBlock, "Skills");

            let argArray = ["Acrobatics", "Arcana", "Athletics", "Crafting", "Deception", "Diplomacy", "Intimidation",
                "Lore", "Medicine", "Nature", "Occultism", "Performance", "Religion", "Society", "Stealth", "Survival",
                "Thievery"];
            argArray.forEach(skill => {
                let re = new RegExp(`(?<=${skill}\\s).*?(?=\\s*[,~])`, 'gi');
                populateStat(characterId, statBlock, re, skill.toLowerCase());
                populateStat(characterId, statBlock, re, "npc_" + skill.toLowerCase());
            });

            argArray = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
            argArray.forEach(stat => {
                let s = stat.substring(0, 3);
                let re = new RegExp(`(?<=${s}\\s).*?(?=[,~])`, 'gi');
                statBlock = populateStat(characterId, statBlock, re, stat.toLowerCase() + "_modifier");
            });

            removeLeadingDelimiters(statBlock);
            let interactionAbilities = firstMatch(statBlock, /.*?(?=AC\s+\d+)/).trim();
            interactionAbilities = interactionAbilities.replace(/Items.*?~/, "").trim();
            interactionAbilities = removeLeadingDelimiters(interactionAbilities);
            let interactionArray = interactionAbilities.replace(/\.\s*~/, ".~").split(".~");
            if (interactionArray.length > 0) {
                interactionArray = interactionArray.filter(item => item.trim() !== "");
                interactionArray.forEach(item => {
                    let words = item.split(' ');
                    let itemName = words[0];

                    for (let i = 0; i < words.length; i++) {
                        if (words[i + 1][0] === words[i + 1][0].toUpperCase() && words[i + 1][0] !== '(') {
                            itemName = itemName + " " + words[i];
                        } else {
                            break;
                        }
                    }
                    item = item.replace(itemName.trim(), "");
                    item = item.replaceAll("~", "").trim();
                    let repTraits = firstMatch(item, /^\s*\(.+?\)/);
                    item = item.replace(repTraits, "").trim();
                    let attributeName = "repeating_interaction-abilities_" + generateRowID() + "_";
                    setAttribute(characterId, attributeName + "name", itemName);
                    setAttribute(characterId, attributeName + "npc_description", item);
                    setAttribute(characterId, attributeName + "description", item);
                    setAttribute(characterId, attributeName + "rep_traits", repTraits);
                    setAttribute(characterId, attributeName + "toggles", "display,");
                });
            }

            let hasItems = firstMatch(statBlock, /.*?(?=AC\s+\d+)/).trim();
            if (hasItems.includes("Items")) {
                let items = firstMatch(hasItems, /(?<=Items\s*).*?(?=~)/si, true).trim();
                let itemsArray = items.split(",");

                itemsArray.forEach(item => {
                    let attributeName = "repeating_items-worn_-" + generateRowID() + "_";
                    setAttribute(characterId, attributeName + "worn_item", item.trim());
                    setAttribute(characterId, attributeName + "worn_misc", item.trim());
                    setAttribute(characterId, attributeName + "toggles", "display,");
                });
            }

            statBlock = populateStat(characterId, statBlock, /(?<=\s*AC).*?(?=;)/, "ac", "armor_class", "npc_armor_class");
            statBlock = populateStat(characterId, statBlock, /(?<=Fort).*?(?=,)/, "npc_saving_throws_fortitude", "saving_throws_fortitude");
            statBlock = populateStat(characterId, statBlock, /(?<=Ref).*?(?=,)/, "npc_saving_throws_reflex", "saving_throws_reflex");
            statBlock = populateStat(characterId, statBlock, /(?<=Will).*?(?=~)/, "npc_saving_throws_will", "saving_throws_will");
            statBlock = populateStat(characterId, statBlock, /(?<=HP).*?(?=[~;])/, "npc_hit_points", "hit_points");
            populateStat(characterId, statBlock, /(?<=Immunities).*?(?=[~;])/, "immunities");
            populateStat(characterId, statBlock, /(?<=Weaknesses).*?(?=[~;])/, "weaknesses");
            populateStat(characterId, statBlock, /(?<=Resistances).*?(?=[~;])/, "resistances");
            statBlock = populateStat(characterId, statBlock, /(?<=Speed).*?(?=~)/, "speed", "speed_base", "speed_notes");

            const matchMelee = new RegExp(/Melee.*?(?=(Melee|([A-Z][a-z]+\s)*Spells|Ranged|$))/gm);
            const matchRanged = new RegExp(/Ranged.*?(?=(Melee|([A-Z][a-z]+\s)*Spells|Ranged|$))/gm);
            const matchSpells = new RegExp(/([A-Z][a-z]+\s)*Spells.*?(?=(Melee|([A-Z][a-z]+\s)+|Ranged|$))/gm);
            const matchSneakyOnes = new RegExp(/(?<=\.\s*)([A-Z][a-z]+\s){2,}.*?(?=\.\s*(([A-Z][a-z]+\s){2,})|$)/gm);
            const matchTheRest = new RegExp(/(([A-Z][a-z]+\s(\w+\s)*)+\[).*?((?=(([A-Z][a-z]+\s(\w+\s)*)+\[))|$)/gm);

            statBlock = statBlock.replaceAll("~", "");

            let meleeAttacks = statBlock.match(matchMelee) || [];
            meleeAttacks.forEach(ability => parseAttackAbility(characterId, ability, "Melee"));
            statBlock = statBlock.replace(matchMelee, "");

            let rangedAttacks = statBlock.match(matchRanged) || [];
            rangedAttacks.forEach(ability => parseAttackAbility(characterId, ability, "Ranged"));
            statBlock = statBlock.replace(matchRanged, "");

            let spells = statBlock.match(matchSpells) || [];
            spells.forEach(ability => parseSpells(characterId, ability));
            statBlock = statBlock.replace(matchSpells, "");

            let theRest = statBlock.match(matchTheRest) || [];
            theRest.forEach(ability => {
                let sneaky = ability.match(matchSneakyOnes) || [];
                sneaky.forEach(miniAbility => parseSpecialAbility(characterId, miniAbility));
                ability = ability.replace(matchSneakyOnes, "");
                parseSpecialAbility(characterId, ability);
            });

            speakAsGuidanceToGM(npcName + " has been imported.");
        } catch (err) {
            speakAsGuidanceToGM("NPC Sheet Population Error");
            debugLog(err)
            debugLog(new Error().stack);
        }
    }

    let parseAttackAbility = function (characterId, ability, attackType) {
        const weaponName = ability.match(/\[\w+-\w+\]/)[0] + " " + ability.match(/(?<=(Melee|Ranged)\s\[.*\]\s).*?(?=\s(\+|\-))/)[0];
        const attackBonusMatch = ability.match(/(\+|\-)(\d+)/)[0];
        const traits = ability.match(/\((.+?)\)/)[1];
        const damageMatch = ability.match(/(?<=Damage\s+)(\d+d\d+\+\d+\s+\w+(\s+plus\s+\w+.*)*)/)[0];

        const attributeName = "repeating_" + attackType.toLowerCase() + "-strikes_" + generateRowID() + "_";
        if (traits.includes("agile")) {
            setAttribute(characterId, attributeName + "weapon_agile", "1");
        }
        setAttribute(characterId, attributeName + "weapon", weaponName.trim());
        setAttribute(characterId, attributeName + "weapon_traits", traits.trim());
        setAttribute(characterId, attributeName + "npc_weapon_strike", attackBonusMatch.trim());
        setAttribute(characterId, attributeName + "weapon_strike", attackBonusMatch.replace("+", ""));
        setAttribute(characterId, attributeName + "weapon_map2", "@{strikes_map2}");
        setAttribute(characterId, attributeName + "weapon_map3", "@{strikes_map3}");

        let damage = damageMatch.trim().split(" ");
        setAttribute(characterId, attributeName + "npc_weapon_strike_damage", damage[0]);
        setAttribute(characterId, attributeName + "weapon_strike_damage", damage[0]);
        setAttribute(characterId, attributeName + "weapon_strike_damage_type", damage[1]);
        if (damage[2] != undefined) {
            let extra = "";
            for (let i = 2; i < damage.length; i++) {
                if (/\d+d\d+(\+\d+)*/.test(damage[i])) {
                    extra = extra + " [[" + damage[i] + "]]";
                } else {
                    extra = extra + " " + damage[i];
                }
            }
            setAttribute(characterId, attributeName + "weapon_strike_damage_additional", extra);
        }
        setAttribute(characterId, attributeName + "toggles", "display,");
    }

    let parseSpells = function (characterId, ability) {
        const attributeName = "repeating_actions-activities_" + generateRowID() + "_";
        const spells = ability.match(/.*Spells/)[0].trim();
        const theRest = ability.match(/(?<=Spells\s+).*/)[0].trim();
        const matchSpellDC = new RegExp(/(?<=DC\s)\d+/);
        const matchAttack = new RegExp(/(?<=,\sattack\s)(\+|\-)\d+?(?=;)/);
        setAttribute(characterId, attributeName + "name", spells);
        setAttribute(characterId, attributeName + "npc_description", theRest);
        setAttribute(characterId, attributeName + "description", theRest);
        setAttribute(characterId, attributeName + "toggles", "display,");
        let spellDC = "";
        let attackBonus = "";

        if (matchSpellDC.test(theRest)) {
            spellDC = theRest.match(matchSpellDC)[0];
        }
        if (matchAttack.test(theRest)) {
            attackBonus = theRest.match(matchAttack)[0];
        }

        const argArray = ["10th", "9th", "8th", "7th", "6th", "5th", "4th", "3rd", "2nd", "1st", "Cantrips"];

        argArray.forEach(spellsInLevel => {
            let re = new RegExp(`(?<=${spellsInLevel}\\s).*?(?=;\\s*([0-9]|Cantrips|$))`, 'gm');
            let level = ability.match(re)[0];

            let slots, spellLevel;
            try {
                spellLevel = level.match(/(^\d+)/)[0];

                if (/\(\d+\sslots\)/.test(level)) {
                    slots = level.match(/(?<=\()\d+?(?=\sslots\))/)[0];
                    level = level.replace(/\(\d+\sslots\)/, "");
                }
                setAttribute(characterId, "level_" + spellLevel + "_per_day", slots);
            } catch (e) {
                spellLevel = "Cantrip";
            }

            let spellList = level.split(",");
            spellList.forEach(spellName => {
                let attributeName;
                if (spellsInLevel.includes("Cantrip")) {
                    attributeName = "repeating_cantrip_" + generateRowID() + "_";
                } else {
                    attributeName = "repeating_normalspells_" + generateRowID() + "_";
                }
                setAttribute(characterId, attributeName + "toggles", "display,");
                setAttribute(characterId, attributeName + "name", spellName);
                setAttribute(characterId, attributeName + "spelllevel", spellLevel);
                setAttribute(characterId, attributeName + "description", "Unable to populate due to Roll20 limitations");
                try {
                    setAttribute(characterId, attributeName + "spell_dc", spellDC);
                    setAttribute(characterId, attributeName + "spellattack", attackBonus);
                    setAttribute(characterId, attributeName + "spellattack_final", attackBonus);
                } catch (e) {
                    debugLog("No Spell DC/Attack Bonus");
                }
            });
        });
    }

    let parseSpecialAbility = function (characterId, ability) {
        const attributeName = "repeating_actions-activities_" + generateRowID() + "_";
        const name = ability.match(/.*(?=\[)/)[0].trim();
        const actions = ability.match(/(?<=\[\s*).*(?=\])/)[0].trim();
        const theRest = ability.match(/(?<=\)\s+).*/)[0].trim();
        const traits = ability.match(/(?<=\(\s+).*?(?=\))/)[0].trim();

        setAttribute(characterId, attributeName + "toggles", "display,");
        setAttribute(characterId, attributeName + "name", name);
        setAttribute(characterId, attributeName + "actions", actions);
        setAttribute(characterId, attributeName + "npc_description", theRest);
        setAttribute(characterId, attributeName + "description", theRest);
        setAttribute(characterId, attributeName + "rep_traits", traits);

        // "{\"name\":repeating_actions-activities_-NdaMBK3YWjc4dEz7vuk_source\",\"current\":\"\",\"max\":\"\"}"
    }

    //<editor-fold desc="configureToken - link the token stats to the NPC sheet and show the name">
    let configureToken = function (selectedNPC) {
        try {
            let characterId = selectedNPC.characterId;
            let npcToken = selectedNPC.npcToken;
            let characterSheet = selectedNPC.characterSheet;
            let hitPoints = getAttribute(characterId, "hit_points");
            let armorClass = getAttribute(characterId, "armor_class");

            debugLog("Configuring token for " + characterId + " - " + characterSheet.get("name"));
            npcToken.set("showname", true);
            npcToken.set("bar3_value", "AC " + armorClass.get("current"));
            npcToken.set("bar3_max", "-0");
            npcToken.set("bar1_link", hitPoints.id);
        } catch (err) {
            speakAsGuidanceToGM("Token Configuration Error - Check to make sure the tokens are linked to the selected NPCs.");
            debugLog(err);
            debugLog(new Error().stack);
        }
    };
    //</editor-fold>

    //<editor-fold desc="eraseCharacter - Remove all Attributes and Macros from the NPC sheet">
    let eraseCharacter = function (c) {
        for (const attribute of findObjs({_characterid: c.characterId, _type: "attribute"})) {
            debugLog("Removing " + attribute.get("name"));
            attribute.remove();
        }
        for (const ability of findObjs({_characterid: c.characterId, _type: "ability"})) {
            debugLog("Removing " + ability.get("name"));
            ability.remove();
        }
        for (let i = 1; i < 4; i++) {
            c.npcToken.set("bar" + i + "_value", "");
            c.npcToken.set("bar" + i + "_max", "");
        }

        speakAsGuidanceToGM("Removed all properties for " + c.characterSheet.get("name"));
        c.characterSheet.set("name", "Erased Character");
    }
    //</editor-fold>
}
());