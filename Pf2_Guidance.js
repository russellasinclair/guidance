var Guidance = Guidance || function () {
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
    let getFirstMatchingElement = function (source, regex, ignoreEmpty) {
        let match = getMatchingArray(source, regex, ignoreEmpty);
        if (match[0] == null) {
            if (ignoreEmpty == undefined) {
                return "";
            }
            return source;
        }
        return match[0].trim();
    }

    let getMatchingArray = function (source, regex) {
        let match = source.match(regex);
        if (match == null || match.length === 0 || !Array.isArray(match)) {
            debugLog("source=" + source + ", regex=" + regex + " didn't return an array");
            return [];
        }
        return match;
    }

    let getSubstringStartingFrom = function (source, delimit) {
        let index = source.toLowerCase().indexOf(delimit.toLowerCase());
        if (index === -1) {
            return "";
        }
        return source.substr(index + delimit.length).trim();
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
        if (debugMode) {
            let timestamp = new Date().toUTCString();
            let stackTrace = new Error().stack.split("\n");
            log(`${timestamp} ${stackTrace[2].trim()} ${text}`);
        }
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
                // debugLog("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterId + " with a value of " + newValue + ".");
            } else {
                if (typeof operator !== "undefined" && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }

                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
                // debugLog("DefaultAttributes: Setting " + attributeName + " on character ID " + characterId + " to a value of " + newValue + ".");
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
        let current = getFirstMatchingElement(statBlock, regex);

        if (current === "") {
            return statBlock;
        }
        current = current.replaceAll("~", "").trim();

        if (Array.isArray(stats)) {
            stats.forEach(stat => {
                setAttribute(characterId, stat, current);
            });
        } else {
            setAttribute(characterId, stats, current);
        }

        statBlock = getSubstringStartingFrom(statBlock, current);
        statBlock = removeLeadingDelimiters(statBlock);
        return statBlock;
    }

    function removeLeadingDelimiters(source) {
        source = source.trim();
        if (source.startsWith(";")) {
            source = getSubstringStartingFrom(source, ";");
        }
        if (source.startsWith("~")) {
            source = getSubstringStartingFrom(source, "~");
        }
        return source;
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

    ////////////////////////////////////////////////////////////////////////////////////////////////

    let populateCharacterSheet = function (gmNotes, selectedNPC) {
        try {
            const characterId = selectedNPC.characterId;
            const npcToken = selectedNPC.npcToken;
            const characterSheet = selectedNPC.characterSheet;
            let statBlock = cleanText(gmNotes).replaceAll("Damage", "damage");

            npcToken.set("gmnotes", statBlock);
            setAttribute(characterId, "npc_type", "Creature");
            setAttribute(characterId, "sheet_type", "npc");

            let npcName = toTitleCase(getFirstMatchingElement(statBlock, /.*?(?=(Creature|Level).*\d+)/im));
            characterSheet.set("name", npcName);
            npcToken.set("name", npcName);

            statBlock = populateStat(characterId, statBlock, /(?<=(Creature|Level)\s+).+?(?=~|\s+)/si, "level");
            statBlock = populateStat(characterId, statBlock, /(?<=.*)(LG|NG|CG|LN|N|CN|LE|NE|CE)(?=\s+)/s, "alignment");
            statBlock = populateStat(characterId, statBlock, /(?<=.*)(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)(?=\s+)/si, "size");
            statBlock = populateStat(characterId, statBlock, /.*?(?=Source|Perception)/s, "traits");
            statBlock = populateStat(characterId, statBlock, /.*?(?=Perception)/s, "source");
            statBlock = populateStat(characterId, statBlock, /(?<=.*Perception).*?(?=;)/s, "npc_perception", "perception");
            statBlock = populateStat(characterId, statBlock, /.*?(?=~|Skills|Languages)/s, "senses");
            statBlock = populateStat(characterId, statBlock, /(?<=Languages).*?(?=Skills|~)/s, "languages");
            statBlock = getSubstringStartingFrom(statBlock, "Skills");

            ["Acrobatics", "Arcana", "Athletics", "Crafting", "Deception", "Diplomacy", "Intimidation",
                "Lore", "Medicine", "Nature", "Occultism", "Performance", "Religion", "Society", "Stealth", "Survival",
                "Thievery"].forEach(skill => {
                let re = new RegExp(`(?<=${skill}\\s).*?(?=\\s*[,~])`, 'gi');
                populateStat(characterId, statBlock, re, skill.toLowerCase());
                populateStat(characterId, statBlock, re, "npc_" + skill.toLowerCase());
            });

            ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"].forEach(stat => {
                let s = stat.substring(0, 3);
                let re = new RegExp(`(?<=${s}\\s).*?(?=[,~])`, 'gi');
                statBlock = populateStat(characterId, statBlock, re, stat.toLowerCase() + "_modifier");
            });

            let senseAbilities = getFirstMatchingElement(statBlock, /^.*?(?=(AC\s|Items))/);
            senseAbilities = massageTheDataForAbilityParsing(senseAbilities);
            let newRegex = new RegExp(/((([A-Z][a-z]+\s)+[\[\(])|([A-Z][a-z]+\s){2,}).*?(?=\.\s(([A-Z][a-z]+\s)+[\[\(])|$|([A-Z][a-z]+\s){3,})/, "gm");
            abilityHandler(characterId, senseAbilities, newRegex, parseInteractionAbility);

            let hasItems = getFirstMatchingElement(statBlock, /.*?(?=AC\s+\d+)/).trim();
            if (hasItems.includes("Items")) {
                let items = getFirstMatchingElement(hasItems, /(?<=Items\s*).*?(?=(AC|~|$))/si, true).trim();
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
            let matchExtaSave = new RegExp(/(?<=Will\s[+\-]\d;).*?(?=(HP|;|~))/);
            if (matchExtaSave.test(statBlock)) {
                let saveDetails = getFirstMatchingElement(statBlock, matchExtaSave);
                setAttribute(characterId, "saving_throws_notes", saveDetails);
            }
            statBlock = populateStat(characterId, statBlock, /(?<=Will).*?(?=(HP|;|~))/, "npc_saving_throws_will", "saving_throws_will");

            populateStat(characterId, statBlock, /(?<=HP).*?(?=[~;])/, "npc_hit_points", "hit_points");
            populateStat(characterId, statBlock, /(?<=Immunities).*?(?=[~;])/, "immunities");
            populateStat(characterId, statBlock, /(?<=Weaknesses).*?(?=[~;])/, "weaknesses");
            populateStat(characterId, statBlock, /(?<=Resistances).*?(?=[~;])/, "resistances");

            // Defensive Abilities
            let defenseAbilities = getFirstMatchingElement(statBlock, /(?<=HP\s\d+[\s;]).*?(?=Speed)/);
            newRegex = new RegExp(/((([A-Z][a-z]+\s)+([\[(]))|([A-Z][a-z]+\s){2,}).*?(?=\.\s(([A-Z][a-z]+\s)+([\[(]))|$|([A-Z][a-z]+\s){2,})/, "gm");
            defenseAbilities = massageTheDataForAbilityParsing(defenseAbilities);
            abilityHandler(characterId, defenseAbilities, newRegex, parseAutomaticAbility);

            statBlock = populateStat(characterId, statBlock, /(?<=Speed).*?(?=~)/, "speed", "speed_base", "speed_notes");

            statBlock = massageTheDataForAbilityParsing(statBlock);

            getMatchingArray(statBlock, /[^\[]\d+d\d+(\+\d+)*/gm)
                .forEach(n => statBlock = statBlock.replaceAll(n, " [[" + n.trim() + "]]"));

            newRegex = new RegExp(/Melee.*?(?=((([A-Z][a-z]+\s(\w+\s)*)+(\[|Spells))|(\.\s*~\s*([A-Z][a-z]+\s)+))|$|Melee|Ranged|(([A-Z][a-z]+\s)+\())/, "gm");
            statBlock = abilityHandler(characterId, statBlock, newRegex, parseAttackAbility);

            newRegex = new RegExp(/Ranged.*?(?=((([A-Z][a-z]+\s(\w+\s)*)+(\[|Spells))|(\.\s*~\s*([A-Z][a-z]+\s)+))|$|Ranged|(([A-Z][a-z]+\s)+\())/, "gm");
            statBlock = abilityHandler(characterId, statBlock, newRegex, parseAttackAbility);

            newRegex = new RegExp(/(([A-Z][a-z]+\s(\w+\s)*)+(Spells)).*?(?=((([A-Z][a-z]+\s(\w+\s)*)+(\[|Spells))|(\.\s*~\s*([A-Z][a-z]+\s)+))|$|(([A-Z][a-z]+\s)+\())/, "gm");
            statBlock = abilityHandler(characterId, statBlock, newRegex, parseSpells);

            newRegex = new RegExp(/(([A-Z][a-z]+\s){2,}|(([A-Z][a-z]+\s+)+[\[(])).*?[\.\)]\s*(?=(([A-Z][a-z]+\s){2,})|(([A-Z][a-z]+\s+)+[\[(])|$)/, "gm");
            statBlock = abilityHandler(characterId, statBlock, newRegex, parseSpecialAbility);

            speakAsGuidanceToGM(npcName + " has been imported.");
        } catch (err) {
            speakAsGuidanceToGM("NPC Sheet Population Error");
            debugLog(err)
            debugLog(new Error().stack);
        }
    }

    // I hate this method, I wish I had better delimiters
    let massageTheDataForAbilityParsing = function (data) {
        return data.replaceAll("~", "")
            .replaceAll("And", "and")
            .replaceAll("Grab", "grab")
            .replaceAll("Hit Points", "hit points")
            .replaceAll("Saving Throw", "saving throw")
            .replace(/[A-Z][a-z]*\s(of|to)\s[A-Z][a-z]/, function (match) {
                return toTitleCase(match);
            })
            .replaceAll("Effect", "effect")
            .replaceAll("Trigger", "trigger")
            .trim();
    }

    let abilityHandler = function (characterId, source, regex, processor) {
        debugLog("Regex: " + regex.source);
        debugLog("Source: " + source);

        let safety = 0;
        let ability = getFirstMatchingElement(source, regex);
        let temp;
        if (ability.startsWith("Melee")) {
            temp = "Melee";
        } else if (ability.startsWith("Ranged")) {
            temp = "Ranged";
        }

        while (ability !== "" && safety++ < 10) {
            if (temp == undefined) {
                processor(characterId, ability);
            } else {
                processor(characterId, ability, temp);
            }
            source = source.replaceAll(ability.trim(), "").trim();
            ability = getFirstMatchingElement(source, regex);
        }
        return source;
    }

    let parseAutomaticAbility = function (characterId, ability) {
        debugLog("parseAutomaticAbility: " + ability);
        let attributeName = "repeating_free-actions-reactions_" + generateRowID() + "_";
        let itemName = getFirstMatchingElement(ability, /([A-Z][a-z]*\s)+(?=([\(\[])|([A-Z][a-z]*))/).trim();
        ability = ability.replace(itemName, "");
        ability = ability.replaceAll("~", "");
        let repTraits = getFirstMatchingElement(ability, /^\s*\(.+?\)/);
        ability = ability.replace(repTraits, "");
        let trigger = getFirstMatchingElement(ability, /(?<=trigger\s).*?(?=(effect|$))/);
        let effect = getFirstMatchingElement(ability, /\seffect.*/)

        if (/\[\s*free.action\s*\]/.test(ability)) {
            setAttribute(characterId, attributeName + "free_action", "free action");
        }
        if (/\[\s*reaction\s*\]/.test(ability)) {
            setAttribute(characterId, attributeName + "reaction", "reaction");
        }

        getMatchingArray(ability, /[^\[]\d+d\d+(\+\d+)*/gm)
            .forEach(n => ability = ability.replaceAll(n, " [[" + n.trim() + "]]"));
        setAttribute(characterId, attributeName + "name", itemName);
        setAttribute(characterId, attributeName + "npc_description", ability);
        setAttribute(characterId, attributeName + "description", ability);
        setAttribute(characterId, attributeName + "rep_traits", repTraits);
        setAttribute(characterId, attributeName + "trigger", trigger);
        setAttribute(characterId, attributeName + "npc_weapon_notes", effect);
        setAttribute(characterId, attributeName + "toggles", "display,");
    }

    let parseInteractionAbility = function (characterId, ability) {
        debugLog("parseInteractionAbility = " + ability);
        let itemName = getFirstMatchingElement(ability, /([A-Z][a-z]*\s)+(?=([\(\[])|([A-Z][a-z]*))/).trim();
        ability = ability.replace(itemName, "");
        ability = ability.replaceAll("~", "");
        let repTraits = getFirstMatchingElement(ability, /^\s*\(.+?\)/);
        ability = ability.replace(repTraits, "");
        let attributeName = "repeating_interaction-abilities_" + generateRowID() + "_";
        getMatchingArray(ability, /[^\[]\d+d\d+(\+\d+)*/gm)
            .forEach(n => ability = ability.replaceAll(n, " [[" + n.trim() + "]]"));
        setAttribute(characterId, attributeName + "name", itemName);
        setAttribute(characterId, attributeName + "npc_description", ability);
        setAttribute(characterId, attributeName + "description", ability);
        setAttribute(characterId, attributeName + "rep_traits", repTraits);
        setAttribute(characterId, attributeName + "toggles", "display,");
        let effect = getFirstMatchingElement(ability, /\seffect.*/)
        setAttribute(characterId, attributeName + "npc_weapon_notes", effect);

        let trigger = getFirstMatchingElement(ability, /(?<=trigger\s).*?(?=(effect|$))/);
        setAttribute(characterId, attributeName + "trigger", trigger);

    }

    let parseAttackAbility = function (characterId, ability, attackType) {
        debugLog("parseAttackAbility = " + ability);
        const weaponName = getFirstMatchingElement(ability, /\[\w+-\w+\]/) + " " +
            getFirstMatchingElement(ability, /(?<=(Melee|Ranged)\s\[.*\]\s).*?(?=\s[+\-])/);
        const attackBonusMatch = getFirstMatchingElement(ability, /[+\-](\d+)/);
        let traits = getFirstMatchingElement(ability, /(?<=\()(.+?)(?=\))/);
        let effect = getFirstMatchingElement(ability, /effect.*/);

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
        setAttribute(characterId, attributeName + "npc_weapon_notes", effect);

        let damage = getFirstMatchingElement(ability, /(?<=damage\s)\[+\d+d\d+(\+\d+)*?\]+/);
        let damageType = getFirstMatchingElement(ability, /(?<=damage\s\[+\d+d\d+(\+\d+)*?\]+\s)\w+/);
        setAttribute(characterId, attributeName + "npc_weapon_strike_damage", damage);
        setAttribute(characterId, attributeName + "weapon_strike_damage", damage);
        setAttribute(characterId, attributeName + "weapon_strike_damage_type", damageType);
        let extra = getFirstMatchingElement(ability, /(?<=damage\s\[+\d+d\d+(\+\d+)*?\]+\s\w+\s).+/);
        setAttribute(characterId, attributeName + "weapon_strike_damage_additional", extra);
        setAttribute(characterId, attributeName + "toggles", "display,");
    }

    let parseSpells = function (characterId, ability) {
        debugLog("parseSpells = " + ability);
        const attributeName = "repeating_actions-activities_" + generateRowID() + "_";
        const spells = getFirstMatchingElement(ability, /.*Spells/);
        let theRest = getFirstMatchingElement(ability, /(?<=Spells\s+).*/);
        const matchSpellDC = new RegExp(/(?<=DC\s)\d+/);
        const matchAttack = new RegExp(/(?<=,\sattack\s)([+\-])\d+?(?=;)/);
        setAttribute(characterId, attributeName + "name", spells);
        setAttribute(characterId, attributeName + "npc_description", theRest);
        setAttribute(characterId, attributeName + "description", theRest);
        setAttribute(characterId, attributeName + "toggles", "display,");

        let toggles = "color:default.normalspells";
        if (ability.includes("Cantrip")) {
            toggles = toggles + ",cantrips"
        }
        toggles = toggles + ",npcspellcasters";
        setAttribute(characterId, "toggles", toggles);

        let spellDC = "";
        let attackBonus = "";

        if (matchSpellDC.test(theRest)) {
            spellDC = getFirstMatchingElement(theRest, matchSpellDC);
            setAttribute(characterId, "npc_spell_dc", spellDC);
        }
        if (matchAttack.test(theRest)) {
            attackBonus = getFirstMatchingElement(theRest, matchAttack);
            setAttribute(characterId, "npc_spell_attack", attackBonus);
        }

        ["10th", "9th", "8th", "7th", "6th", "5th", "4th", "3rd", "2nd", "1st", "Cantrips"].forEach(spellsInLevel => {
            let re = new RegExp(`(?<=${spellsInLevel}).*?(?=(;|$))`)
            let levelArray = getMatchingArray(ability, re);

            if (levelArray.length > 0) {
                let level = levelArray[0];
                let slots, spellLevel;
                if (!spellsInLevel.includes("Cantrip")) {
                    spellLevel = getFirstMatchingElement(spellsInLevel, /(^\d+)/);

                    if (/\(\d+\sslots\)/.test(level)) {
                        slots = getFirstMatchingElement(level, /(?<=\()\d+?(?=\sslots\))/);
                        level = level.replace(/\(\d+\sslots\)/, "");
                    }
                    setAttribute(characterId, "level_" + spellLevel.trim() + "_per_day", slots);
                } else {
                    spellLevel = "Cantrip";
                }

                let spellList = level.split(",");
                for (let i = 0; i < spellList.length; i++) {
                    if (spellList[i].includes(")") && !spellList[i].includes("(")) {
                        spellList[i - 1] = spellList[i - 1] + ", " + spellList[i];
                        spellList[i] = "";
                    }
                }

                spellList = spellList.filter(n => n);

                spellList.forEach(spellName => {
                    let attributeName;
                    if (spellLevel.includes("Cantrip")) {
                        attributeName = "repeating_cantrip_" + generateRowID() + "_";
                    } else {
                        attributeName = "repeating_normalspells_" + generateRowID() + "_";
                        setAttribute(characterId, attributeName + "spelllevel", spellLevel);
                        setAttribute(characterId, attributeName + "current_level", spellLevel);
                    }
                    setAttribute(characterId, attributeName + "toggles", "display,");
                    setAttribute(characterId, attributeName + "name", spellName.trim());
                    setAttribute(characterId, attributeName + "description", "Unable to populate due to Roll20 limitations");
                    setAttribute(characterId, attributeName + "cast_actions", "other");

                    try {
                        setAttribute(characterId, attributeName + "spell_dc", spellDC);
                        setAttribute(characterId, attributeName + "spellattack", attackBonus);
                        setAttribute(characterId, attributeName + "spellattack_final", attackBonus);
                    } catch (e) {
                        debugLog("No Spell DC/Attack Bonus");
                    }
                });
            }
        });
    }

    let parseSpecialAbility = function (characterId, ability) {
        debugLog("parseSpecialAbility = " + ability);
        const attributeName = "repeating_actions-activities_" + generateRowID() + "_";
        let name = getFirstMatchingElement(ability, /.*?(?=([\[(]))/);
        let actions = getFirstMatchingElement(ability, /(?<=\[\s*).*action?(?=\])/);
        let theRest = getFirstMatchingElement(ability, /(?<=([)\]])\s+).*/);
        let traits = getFirstMatchingElement(ability, /(?<=\(\s+).*?(?=\))/);
        let trigger = getFirstMatchingElement(ability, /(?<=trigger\s).*?(?=(effect|$))/);
        if (theRest === "") {
            name = getFirstMatchingElement(ability, /([A-Z][a-z]*\s)+?(?=[A-Z][a-z]*)/);
            theRest = ability.replaceAll(name, "");
        }

        setAttribute(characterId, attributeName + "toggles", "display,");
        setAttribute(characterId, attributeName + "name", name);
        setAttribute(characterId, attributeName + "actions", actions);
        setAttribute(characterId, attributeName + "npc_description", theRest);
        setAttribute(characterId, attributeName + "description", theRest);
        setAttribute(characterId, attributeName + "rep_traits", traits);
        setAttribute(characterId, attributeName + "trigger", trigger);
    }
}
();
