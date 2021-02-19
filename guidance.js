/*
Starfinder utilities for Roll20
Requires API, Starfinder (Simple) character sheets - official sheets not supported at this time.
!sf_populate - will parse a stat-block in the GM Notes of a character, and populate the NPC tab of the character sheet with the values
*/
let Guidance = Guidance || (function () {
    "use strict";

    let version = "-=> Guidance is online. v1.Dogfood <=-";
    let debugMode = true;

    /// Class that represents a NPC/Starship that is being worked on.
    class NPC {
        constructor(characterId, token, characterSheet) {
            this.characterId = characterId;
            this.tokenLinkedToNpcCharacterSheet = token;
            this.characterSheet = characterSheet;
        }

        showContents() {
            debugLog("Character ID = " + this.characterId);
            debugLog("tokenLinkedToNpcCharacterSheet = " + this.tokenLinkedToNpcCharacterSheet);
        }
    }

    on("ready", function () {
        if (debugMode) {
            speakAsGuidanceToGM(version);
        }
        speakAsGuidanceToGM("Greetings, I am Guidance. I am here to assist you working with your Starfinders to make " +
            "your time in the Pact Worlds more enjoyable. To learn how to use my services, simply type " +
            "<b>sf_help</b> into the chat.");

        log(version);
    });

    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        if (String(chatMessage.content).startsWith("!sf_help")) {
            speakAsGuidanceToGM("I have several commands I support:<br><br>" +
                "<b><i>!sf_populate</i></b> will allow you to take a Starfinder statblock that is in the GM notes section " +
                "of a selected character and I will attempt to use it to fill out the NPC section of the Starfinder " +
                "(Simple) character sheet. I support statblocks from the Archives of Nethys and the Starjammer SRD. " +
                "<i>I don't do well with Society PDFs</i>. If you want to attempt using one, double check my work.<br><br>" +
                "<b><i>!sf_clean CONFIRM</i></b> will allow me to take a selected character sheet and completely " +
                "<i>AND PERMANENTLY</i> remove all data from it. <i>I recommend against using this unless you are about " +
                "to reimport a character</i>.<br><br><b><i>!sf_token</i></b> will populate the token with hitpoint, " +
                "EAC, and KAC information in the event that the sheet is setup, but the token isn't.<br><br><b><i>" +
                "!sf_init</i></b> will roll group initiative for all selected NPCs");
            return;
        }

        if (isFalsy(chatMessage.selected) || chatMessage.selected.length < 1) {
            speakAsGuidanceToGM("Please select a token representing a character for me to work with");
            return;
        }

        let npcs = getSelectedNPCs(chatMessage);

        try {
            ////////////////////////////////////////////////////////////
            // Roll Initiative for a group of NPCs
            ////////////////////////////////////////////////////////////
            if (String(chatMessage.content).startsWith("!sf_init")) {
                speakAsGuidanceToGM("Rolling NPC initiative for all selected tokens");
                npcs.forEach(function (npc) {
                    let characterId = npc.characterId;
                    let init = attributeToInteger(characterId, "npc-init-misc");
                    let dex = attributeToInteger(characterId, "DEX-bonus");
                    let roll = randomInteger(20) + dex + init;
                    turnorder.push({
                        id: obj[0].id,
                        pr: String(roll) + String(".0" + dex),
                        custom: getAttribute(characterId, "name")
                    });
                });
                Campaign().set("turnorder", JSON.stringify(turnorder));
                debugLog(JSON.stringify(turnorder));
                return;
            }

            ////////////////////////////////////////////////////////////
            // Wipe out all Character Data
            ////////////////////////////////////////////////////////////
            if (String(chatMessage.content).startsWith("!sf_clean CONFIRM")) {
                let msg = String(chatMessage.content).replace("!sf_clean ", "");
                if (npcs.length > 1) {
                    speakAsGuidanceToGM("Please do not select more than 1 NPC at a time. This command is potentially dangerous.");
                    return;
                }
                let c = npcs[0];
                if (msg.startsWith("CONFIRM")) {
                    for (const attribute of findObjs({_characterid: c.characterId, _type: "attribute"})) {
                        debugLog("Removing " + attribute.get("name"));
                        attribute.remove();
                    }
                    for (const ability of findObjs({_characterid: c.characterId, _type: "ability"})) {
                        debugLog("Removing " + ability.get("name"));
                        ability.remove();
                    }
                    for (let i = 1; i < 4; i++) {
                        c.tokenLinkedToNpcCharacterSheet.set("bar" + i + "_value", "");
                        c.tokenLinkedToNpcCharacterSheet.set("bar" + i + "_max", "");
                    }
                    if (debugMode) {
                        c.tokenLinkedToNpcCharacterSheet.set("gmnotes", "");
                    }

                    speakAsGuidanceToGM("Removed all properties for " + c.characterSheet.get("name"));
                    return;
                }
                speakAsGuidanceToGM("Check usage for !sf_clean");
                return;
            }

            ////////////////////////////////////////////////////////////
            // Set up Token
            ////////////////////////////////////////////////////////////
            if (String(chatMessage.content).startsWith("!sf_token")) {
                let c = npcs[0];
                setUpToken(c.characterId, c.tokenLinkedToNpcCharacterSheet);
                return;
            }

            ////////////////////////////////////////////////////////////
            // Populate the Character Sheet
            ////////////////////////////////////////////////////////////
            if (String(chatMessage.content).startsWith("!sf_populate")) {
                let c = npcs[0];
                characterSheet.get("gmnotes", function (gmNotes) {
                    let cleanNotes = cleanText(gmNotes);
                    let section = parseBlockIntoSubSectionMap(cleanNotes);

                    // For Debugging purposes and general information
                    if (debugMode) {
                        tokenLinkedToNpcCharacterSheet.set("gmnotes", cleanNotes);
                    }

                    // Setup Character Sheet
                    setAttribute(c.characterId, "npc-race", c.characterSheet.get("name"));
                    setAttribute(c.characterId, "tab", 4);
                    setAttribute(c.characterId, "npc-tactics-show", 0);
                    setAttribute(c.characterId, "npc-feats-show", 0);
                    populateHeader(c.characterId, section.get("header"));
                    populateDefense(c.characterId, section.get("defense"));
                    populateOffense(c.characterId, section.get("offense"));
                    populateStatics(c.characterId, section.get("statistics"));
                    populateSkills(c.characterId, section.get("statistics"));
                    populateNPC(c.characterId, cleanNotes);
                    populateSpecialAbilities(c.characterId, section.get("special"));

                    // Set up Token
                    setUpToken(c.characterId, c.tokenLinkedToNpcCharacterSheet);
                    if (cleanNotes.toLowerCase().includes("trick attack")) {
                        createObj("ability", {
                            name: "Trick Attack (settings on main sheet)",
                            description: "",
                            action: "&{template:pf_check}{{name=Trick Attack}}{{check=**CR**[[@{trick-attack-skill} - 20]]or lower }} {{foo=If you succeed at the check, you deal @{trick-attack-level} additional damage?{Which condition to apply? | none, | flat-footed, and the target is flat-footed | off-target, and the target is off-target | bleed, and the target is bleeding ?{How much bleed? &amp;#124; 1 &amp;#125; | hampered, and the target is hampered (half speed and no guarded step) | interfering, and the target is unable to take reactions | staggered, and the target is staggered (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | stun, and the target is stunned (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | knockout, and the target is unconscious for 1 minute (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates)} }} {{notes=@{trick-attack-notes}}}",
                            _characterid: c.characterId,
                        });
                        speakAsGuidanceToGM("Trick attack added to selected character");
                    }
                    speakAsGuidanceToGM(c.characterSheet.get("name") + " NPC character sheet processed");
                });
                return;
            }

        } catch (ex) {
            speakAsGuidanceToGM("I have encountered an error. If you can, please report this to the Script Creator.");
            log(ex);
        }
    });

    /////////////////////////////////////////////////////////////////
    // Roll 20 object Interactions
    /////////////////////////////////////////////////////////////////
    let getSelectedNPCs = function (selected) {
        let npcs = [];
        for (const t of selected) {
            let token = findObjs(t);
            let cid = token.get("represents");
            npcs.push(new NPC(cid, token, findObjs({_id: cid, _type: "character"})[0]));
        }

        return npcs;
    };

    let getAttribute = function (characterId, attributeName) {
        return findObjs({
            _characterid: characterId,
            _type: "attribute",
            name: attributeName
        })[0];
    };

    // borrowed from https://app.roll20.net/users/901082/invincible-spleen in the forums
    let setAttribute = function (characterId, attributeName, newValue, operator) {
        let mod_newValue = {
                "+": function (num) {
                    return num;
                },
                "-": function (num) {
                    return -num;
                }
            },

            foundAttribute = getAttribute(characterId, attributeName);

        try {
            if (!foundAttribute) {
                if (typeof operator !== "undefined" && !isNaN(newValue)) {
                    debugLog(newValue + " is a number.");
                    newValue = mod_newValue[operator](newValue);
                }

                // We don't need to create "Blank Values"
                if (!attributeName.includes("show")) {
                    if (isFalsy(newValue) || newValue === "" || newValue === 0) {
                        return;
                    }
                }

                debugLog("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterId + " with a value of " + newValue + ".");
                createObj("attribute", {
                    name: attributeName,
                    current: newValue,
                    max: newValue,
                    _characterid: characterId
                });
            } else {
                if (typeof operator !== "undefined" && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }
                debugLog("DefaultAttributes: Setting " + attributeName + " on character ID " + characterId + " to a value of " + newValue + ".");
                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
            }
        } catch (err) {
            debugLog("Error parsing " + attributeName);
        }
    };

    let setUpToken = function (characterId, tokenLinkedToNpcCharacterSheet) {
        try {
            let hitPoints = getAttribute(characterId, "HP-npc");
            tokenLinkedToNpcCharacterSheet.set("bar1_link", hitPoints.id);
            let armorClass = getAttribute(characterId, "EAC-npc");
            tokenLinkedToNpcCharacterSheet.set("bar2_value", "EAC " + armorClass.get("current"));
            tokenLinkedToNpcCharacterSheet.set("bar2_max", armorClass.get("current"));
            armorClass = getAttribute(characterId, "KAC-npc");
            tokenLinkedToNpcCharacterSheet.set("bar3_value", "KAC " + armorClass.get("current"));
            tokenLinkedToNpcCharacterSheet.set("bar3_max", armorClass.get("current"));
            tokenLinkedToNpcCharacterSheet.set("showname", true);
            speakAsGuidanceToGM("Token setup. For extra settings, check out the API TokenMod");
        } catch (e) {
            speakAsGuidanceToGM("Check to make sure the token is linked and the character sheet is populated");
        }
    };

    /////////////////////////////////////////////////////////////////
    // Population helpers for v 1.0
    /////////////////////////////////////////////////////////////////
    let parseBlockIntoSubSectionMap = function (textToParse) {
        let sections = new Map();
        let parsedText = textToParse;

        sections.set("header", parsedText.substring(0, parsedText.indexOf("DEFENSE")));
        parsedText = parsedText.substring(parsedText.indexOf("DEFENSE"));

        sections.set("defense", parsedText.substring(0, parsedText.indexOf("OFFENSE")));
        parsedText = parsedText.substring(parsedText.indexOf("OFFENSE"));

        if (textToParse.includes("TACTICS")) {
            speakAsGuidanceToGM("Tactics section found. Tactics Processing not yet implemented");
            sections.set("offense", parsedText.substring(0, parsedText.indexOf("TACTICS")));
        } else {
            sections.set("offense", parsedText.substring(0, parsedText.indexOf("STATISTICS")));
        }
        parsedText = parsedText.substring(parsedText.indexOf("STATISTICS"));
        if (textToParse.includes("SPECIAL ABILITIES")) {
            sections.set("statistics", parsedText.substring(0, parsedText.indexOf("SPECIAL ABILITIES")));
            parsedText = parsedText.substring(parsedText.indexOf("SPECIAL ABILITIES"));
            sections.set("special", parsedText);
        } else {
            sections.set("statistics", parsedText);
        }

        return sections;
    };

    let doMagic = function (characterId, textToParse) {
        textToParse = textToParse.substring(textToParse.indexOf("Spell"));
        textToParse = textToParse.replace(/\s+/, " ");
        let attackBonus = "";
        if (textToParse.includes("Spells Known")) {
            setAttribute(characterId, "spellclass-1-level", getValue("CL", textToParse, ";").replace(/\D/g, ""));

            attackBonus = textToParse.replace(/\(.*;/, "");
            attackBonus = attackBonus.replace("Spells Known", "");
            attackBonus = attackBonus.substring(0, attackBonus.indexOf(")"));
            textToParse = textToParse.substring(textToParse.indexOf(")") + 1);

            let level = "";
            if (textToParse.includes("6th")) {
                level = textToParse.substring(textToParse.indexOf("6th"), textToParse.indexOf("5th")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("5th")) {
                level = textToParse.substring(textToParse.indexOf("5th"), textToParse.indexOf("4th")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("4th")) {
                level = textToParse.substring(textToParse.indexOf("4th"), textToParse.indexOf("3rd")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("3rd")) {
                level = textToParse.substring(textToParse.indexOf("3rd"), textToParse.indexOf("2nd")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("2nd")) {
                level = textToParse.substring(textToParse.indexOf("2nd"), textToParse.indexOf("1st")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("1st")) {
                level = textToParse.substring(textToParse.indexOf("1st"), textToParse.indexOf("0 (at will)")).trim();
                addSpell(characterId, level, attackBonus);
            }
            level = textToParse.substring(textToParse.indexOf("0 (at")).trim();
            if (textToParse.includes("Spell-Like Abilities")) {
                level = level.substring(0, level.indexOf("Spell-Like Abilities"));
            }
            addSpell(characterId, level, attackBonus);
        } else {
            setAttribute(characterId, "npc-spells-show", 0);
        }

        if (textToParse.includes("Spell-Like Abilities")) {
            textToParse = textToParse.substring(textToParse.indexOf("Spell-Like Abilities")).trim();
            setAttribute(characterId, "spellclass-0-level", getValue("CL", textToParse, ";").replace(/\D/g, ""));
            textToParse = textToParse.replace(/Spell-Like Abilities/, "").trim();

            attackBonus = textToParse.replace(/\(.*;/, "");
            attackBonus = attackBonus.substring(0, attackBonus.indexOf(")") + 1);

            let lines = textToParse.match(/\d\/\w+|At will|Constant/);
            for (let i = 0; i < lines.length; i++) {
                let ability = "";
                if (isFalsy(lines[i + 1])) {
                    ability = textToParse.substring(textToParse.indexOf(lines[i]));
                } else {
                    ability = textToParse.substring(textToParse.indexOf(lines[i]), textToParse.indexOf(lines[i + 1]));
                }
                addSpellLikeAbility(characterId, ability, attackBonus);
            }
        } else {
            setAttribute(characterId, "npc-spell-like-abilities-show", 0);
        }
    };

    let addSpell = function (characterId, textToParse, additional) {
        textToParse = textToParse.replace(/—/g, "");
        let uuid = generateRowID();
        let value = textToParse.substring(0, textToParse.indexOf("(")).replace(/\D/g, "").trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-level", value);
        value = textToParse.substring(textToParse.indexOf("("), textToParse.indexOf(")") + 1).trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-usage", value);
        value = "(" + additional.trim() + ") " + textToParse.substring(textToParse.indexOf(")") + 1).trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-list", value);
    };

    let addSpellLikeAbility = function (characterId, textToParse, attackBonus) {
        let uuid = generateRowID();
        setAttribute(characterId, "repeating_npc-spell-like-abilities_" + uuid + "_npc-abil-usage", textToParse.substring(0, textToParse.indexOf("—")).trim());
        setAttribute(characterId, "repeating_npc-spell-like-abilities_" + uuid + "_npc-abil-name", attackBonus + " " + textToParse.substring(textToParse.indexOf("—") + 2).trim());
    };

    let populateHeader = function (characterId, textToParse) {
        setAttribute(characterId, "npc-cr", getValue("CR", textToParse));
        setAttribute(characterId, "npc-XP", getValue("XP", textToParse).replace(/\s/, "").replace(/,/, ""));
        setAttribute(characterId, "npc-senses", getValue("Senses", textToParse, ";"));
        setAttribute(characterId, "npc-aura", getStringValue("Aura", textToParse, "DEFENSE"));
    };

    let populateDefense = function (characterId, textToParse) {
        setAttribute(characterId, "EAC-npc", getValue("EAC ", textToParse));
        setAttribute(characterId, "KAC-npc", getValue("KAC", textToParse));
        setAttribute(characterId, "Fort-npc", getValue("Fort", textToParse).replace("+", ""));
        setAttribute(characterId, "Ref-npc", getValue("Ref", textToParse).replace("+", ""));
        setAttribute(characterId, "Will-npc", getValue("Will", textToParse).replace("+", ""));
        setAttribute(characterId, "HP-npc", getValue("HP", textToParse));
        let rp = getValue("RP", textToParse);
        if (!isFalsy(rp)) {
            setAttribute(characterId, "RP-npc", rp);
        }
        setAttribute(characterId, "npc-SR", getValue("SR", textToParse));
        if (textToParse.includes("Weaknesses")) {
            setAttribute(characterId, "npc-resistances", getValue("Resistances", textToParse, "Weaknesses"));
            setAttribute(characterId, "npc-weaknesses", getValue("Weaknesses", textToParse, ";"));
        } else {
            setAttribute(characterId, "npc-resistances", getValue("Resistances", textToParse, ";"));
        }
        setAttribute(characterId, "npc-DR", getValue("DR", textToParse, ";"));

        if (textToParse.includes("SR")) {
            setAttribute(characterId, "npc-immunities", getValue("Immunities", textToParse, "SR"));
        } else {
            setAttribute(characterId, "npc-immunities", getValue("Immunities", textToParse, "OFFENSE"));
        }

        let defensiveAbilities = "";
        if (textToParse.includes("vs.")) {
            let extraSaveStart = textToParse.indexOf("Will") + 3;
            defensiveAbilities = textToParse.substr(extraSaveStart);
            extraSaveStart = defensiveAbilities.indexOf(";");
            defensiveAbilities = defensiveAbilities.substr(extraSaveStart + 1);
            if (defensiveAbilities.includes("Defensive")) {
                defensiveAbilities = defensiveAbilities.substring(0, defensiveAbilities.indexOf("Defensive"));
            }
        }
        if (textToParse.includes("Defensive")) {
            let start = textToParse.indexOf("Defensive Abilities") + "Defensive Abilities".length;
            if (textToParse.includes("Immunities")) {
                textToParse = textToParse.substring(0, textToParse.indexOf("Immunities"));
            }
            defensiveAbilities = textToParse.substring(start) + " " + defensiveAbilities;
        }
        setAttribute(characterId, "npc-defensive-abilities", defensiveAbilities);
    };

    let populateOffense = function (characterId, textToParse) {
        let specialAbilities = getValue("Offensive Abilities", textToParse, "STATISTICS");
        if (specialAbilities.includes("Spell")) {
            specialAbilities = specialAbilities.substring(0, specialAbilities.indexOf("Spell"));
        }
        if (isFalsy(specialAbilities)) {
            setAttribute(characterId, "npc-special-attacks-show", 0);
        } else {
            setAttribute(characterId, "npc-special-attacks", specialAbilities);
        }

        setAttribute(characterId, "speed-base-npc", getMovement("Speed", textToParse));
        setAttribute(characterId, "speed-fly-npc", getMovement("fly", textToParse));
        setAttribute(characterId, "speed-burrow-npc", getMovement("burrow", textToParse));
        setAttribute(characterId, "speed-climb-npc", getMovement("climb", textToParse));
        setAttribute(characterId, "speed-swim-npc", getMovement("swim", textToParse));
        setAttribute(characterId, "space", getMovement("Space", textToParse));
        setAttribute(characterId, "reach", getMovement("Reach", textToParse));

        if (textToParse.toLowerCase().includes("fly")) {
            if (textToParse.includes("(Ex")) {
                setAttribute(characterId, "speed-fly-source-npc", 1);
            } else if (textToParse.includes("(Su")) {
                setAttribute(characterId, "speed-fly-source-npc", 2);
            } else {
                setAttribute(characterId, "speed-fly-source-npc", 3);
            }

            if (textToParse.includes("lumsy)")) {
                setAttribute(characterId, "speed-fly-maneuverability-npc", -8);
            } else if (textToParse.includes("erfect)")) {
                setAttribute(characterId, "speed-fly-maneuverability-npc", 8);
            } else {
                setAttribute(characterId, "speed-fly-maneuverability-npc", 0);
            }
        }

        doWeapons(characterId, textToParse);
        doMagic(characterId, textToParse);
    };

    let getMovement = function (textToFind, textToParse) {
        if (textToParse.includes(textToFind)) {
            return getStringValue(textToFind, textToParse, "ft.").trim();
        }
        return "";
    };

    let populateStatics = function (characterId, textToParse) {
        let stats = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];

        for (const att of stats) {
            let stat = parseFloat(getValue(att, textToParse).replace("+", ""));
            let attUpper = att.toUpperCase();
            setAttribute(characterId, attUpper + "-bonus", String(stat));
            setAttribute(characterId, attUpper + "-temp", String(stat * 2));
        }

        if (!textToParse.includes("Other Abilities")) {
            setAttribute(characterId, "languages-npc", getValue("Languages", textToParse, "Gear"));
        } else {
            setAttribute(characterId, "languages-npc", getValue("Languages", textToParse, "Other"));
        }

        let gear = getValue("Gear", textToParse, "Ecology");
        if (isFalsy(gear) || gear.length < 1) {
            setAttribute(characterId, "npc-gear-show", 0);
        } else {
            setAttribute(characterId, "npc-gear", getValue("Gear", textToParse, "Ecology"));
        }

        let sq = getValue("Other Abilities", textToParse, "Gear");
        if (sq.includes("ECOLOGY")) {
            sq = sq.substring(0, sq.indexOf("ECOLOGY"));
        }
        setAttribute(characterId, "SQ", sq);
    };

    let populateSpecialAbilities = function (characterId, textToParse) {
        debugLog("Parsing Special Abilities");
        let uuid;
        if (!isFalsy(textToParse)) {
            if (textToParse.includes("SPECIAL ABILITIES")) {
                textToParse = textToParse.replace("SPECIAL ABILITIES", "").trim();
                if (textToParse.includes("(")) {
                    do {
                        uuid = generateRowID();
                        let abilityName = textToParse.substring(0, textToParse.indexOf(")") + 1);
                        setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", abilityName.trim());
                        textToParse = textToParse.substring(textToParse.indexOf(")") + 1);
                        let nextAbility = textToParse.match(/\.([^\.]*?)\(..\)/);
                        if (isFalsy(nextAbility)) {
                            setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.trim());
                            return;
                        }
                        let endPoint = textToParse.indexOf(nextAbility[0]) + 1;
                        setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.substring(0, endPoint).trim());
                        textToParse = textToParse.substring(endPoint);
                    } while (textToParse.includes("("));
                } else {
                    uuid = generateRowID();
                    setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", "Special Abilities");
                    textToParse = textToParse.replace(/\./, ".\n");
                    setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.trim());
                }
            }
        } else {
            setAttribute(characterId, "npc-special-abilities-show", 0);
        }
    };

    let populateSkills = function (characterId, textToParse) {
        setAttribute(characterId, "Acrobatics-npc-misc", getSkillValue("Acrobatics", "Dex", textToParse));
        setAttribute(characterId, "Athletics-npc-misc", getSkillValue("Athletics", "Str", textToParse));
        setAttribute(characterId, "Bluff-npc-misc", getSkillValue("Bluff", "Cha", textToParse));
        setAttribute(characterId, "Computers-npc-misc", getSkillValue("Computers", "Int", textToParse));
        setAttribute(characterId, "Culture-npc-misc", getSkillValue("Culture", "Int", textToParse));
        setAttribute(characterId, "Diplomacy-npc-misc", getSkillValue("Diplomacy", "Cha", textToParse));
        setAttribute(characterId, "Disguise-npc-misc", getSkillValue("Disguise", "Cha", textToParse));
        setAttribute(characterId, "Engineering-npc-misc", getSkillValue("Engineering", "Int", textToParse));
        setAttribute(characterId, "Intimidate-npc-misc", getSkillValue("Intimidate", "Cha", textToParse));
        setAttribute(characterId, "Life-Science-npc-misc", getSkillValue("Life-Science", "Int", textToParse));
        setAttribute(characterId, "Medicine-npc-misc", getSkillValue("Medicine", "Int", textToParse));
        setAttribute(characterId, "Mysticism-npc-misc", getSkillValue("Mysticism", "Wis", textToParse));
        setAttribute(characterId, "Physical-Science-npc-misc", getSkillValue("Physical-Science", "Int", textToParse));
        setAttribute(characterId, "Piloting-npc-misc", getSkillValue("Piloting", "Dex", textToParse));
        setAttribute(characterId, "Sense-Motive-npc-misc", getSkillValue("Sense-Motive", "Wis", textToParse));
        setAttribute(characterId, "Sleight-of-Hand-npc-misc", getSkillValue("Sleight-of-Hand", "Dex", textToParse));
        setAttribute(characterId, "Stealth-npc-misc", getSkillValue("Stealth", "Dex", textToParse));
        setAttribute(characterId, "Survival-npc-misc", getSkillValue("Survival", "Wis", textToParse));
        setAttribute(characterId, "Acrobatics-ranks", getSkillValue("Acrobatics", "Dex", textToParse));
        setAttribute(characterId, "Athletics-ranks", getSkillValue("Athletics", "Str", textToParse));
        setAttribute(characterId, "Bluff-ranks", getSkillValue("Bluff", "Cha", textToParse));
        setAttribute(characterId, "Computers-ranks", getSkillValue("Computers", "Int", textToParse));
        setAttribute(characterId, "Culture-ranks", getSkillValue("Culture", "Int", textToParse));
        setAttribute(characterId, "Diplomacy-ranks", getSkillValue("Diplomacy", "Cha", textToParse));
        setAttribute(characterId, "Disguise-ranks", getSkillValue("Disguise", "Cha", textToParse));
        setAttribute(characterId, "Engineering-ranks", getSkillValue("Engineering", "Int", textToParse));
        setAttribute(characterId, "Intimidate-ranks", getSkillValue("Intimidate", "Cha", textToParse));
        setAttribute(characterId, "Life-Science-ranks", getSkillValue("Life-Science", "Int", textToParse));
        setAttribute(characterId, "Medicine-ranks", getSkillValue("Medicine", "Int", textToParse));
        setAttribute(characterId, "Mysticism-ranks", getSkillValue("Mysticism", "Wis", textToParse));
        setAttribute(characterId, "Physical-Science-ranks", getSkillValue("Physical-Science", "Int", textToParse));
        setAttribute(characterId, "Piloting-ranks", getSkillValue("Piloting", "Dex", textToParse));
        setAttribute(characterId, "Sense-Motive-ranks", getSkillValue("Sense-Motive", "Wis", textToParse));
        setAttribute(characterId, "Sleight-of-Hand-ranks", getSkillValue("Sleight-of-Hand", "Dex", textToParse));
        setAttribute(characterId, "Stealth-ranks", getSkillValue("Stealth", "Dex", textToParse));
        setAttribute(characterId, "Survival-ranks", getSkillValue("Survival", "Wis", textToParse));
    };

    let populateNPC = function (characterId, textToParse) {
        setAttribute(characterId, "Perception-npc-misc", getSkillValue("Perception", "Wis", textToParse));
        setAttribute(characterId, "npc-init-misc", getSkillValue("Init", "Dex", textToParse));

        try {
            let section = getStringValue("XP", textToParse, "DEFENSE").trim();
            // let subsections = section.split(" ");

            if (section.includes("LG")) {
                setAttribute(characterId, "npc-alignment", "LG");
            } else if (section.includes("NG")) {
                setAttribute(characterId, "npc-alignment", "NG");
            } else if (section.includes("CG")) {
                setAttribute(characterId, "npc-alignment", "CG");
            } else if (section.includes("LN")) {
                setAttribute(characterId, "npc-alignment", "LN");
            } else if (section.includes("CN")) {
                setAttribute(characterId, "npc-alignment", "CN");
            } else if (section.includes("LE")) {
                setAttribute(characterId, "npc-alignment", "LE");
            } else if (section.includes("NE")) {
                setAttribute(characterId, "npc-alignment", "NE");
            } else if (section.includes("CE")) {
                setAttribute(characterId, "npc-alignment", "CE");
            } else {
                setAttribute(characterId, "npc-alignment", "N");
            }

            let subtypeStart = 0;
            let dropdown = 0;
            if (section.toLowerCase().includes("medium")) {
                dropdown = 0;
                subtypeStart = section.indexOf("Medium") + "Medium".length;
            } else if (section.toLowerCase().includes("large")) {
                dropdown = -1;
                subtypeStart = section.indexOf("Large") + "Large".length;
            } else if (section.toLowerCase().includes("small")) {
                dropdown = 1;
                subtypeStart = section.indexOf("Small") + "Small".length;
            } else if (section.toLowerCase().includes("gargantuan")) {
                dropdown = -4;
                subtypeStart = section.indexOf("Gargantuan") + "Gargantuan".length;
            } else if (section.toLowerCase().includes("huge")) {
                dropdown = -2;
                subtypeStart = section.indexOf("Huge") + "Huge".length;
            } else if (section.toLowerCase().includes("tiny")) {
                dropdown = 2;
                subtypeStart = section.indexOf("Tiny") + "Tiny".length;
            } else if (section.toLowerCase().includes("diminutive")) {
                dropdown = 4;
                subtypeStart = section.indexOf("Diminutive") + "Diminutive".length;
            } else if (section.toLowerCase().includes("fine")) {
                dropdown = 8;
                subtypeStart = section.indexOf("Fine") + "Fine".length;
            } else if (section.toLowerCase().includes("colossal")) {
                dropdown = -8;
                subtypeStart = section.indexOf("Colossal") + "Colossal".length;
            }

            setAttribute(characterId, "npc-size", dropdown);
            setAttribute(characterId, "npc-subtype", section.substring(subtypeStart, section.indexOf("Init")));
        } catch (err) {
            debugLog("Problems with alignment, size,subtype");
        }
    };

    let doWeapons = function (characterId, textToParse) {
        let delimiter = "~~~";
        textToParse = textToParse.replace(/Attacks/i, ""
        ).replace(/ or /g, delimiter
        ).replace(/Ranged/g, delimiter
        ).replace(/Melee/g, delimiter
        ).replace(/OFFENSE/, ""
        ).replace(/Multiattack/, delimiter + "Multiattack"
        );

        if (textToParse.indexOf("Space") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Space"));
        }

        if (textToParse.indexOf("Spell") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Spell"));
        }

        if (textToParse.includes("Speed")) {
            textToParse = textToParse.substring(textToParse.indexOf("ft"));
        }

        if (textToParse.includes("fly")) {
            textToParse = textToParse.substring(textToParse.indexOf("fly"));
            textToParse = textToParse.substring(textToParse.indexOf("ft.") + 3).trim();
            if (textToParse.startsWith("(")) {
                textToParse = textToParse.substring(textToParse.indexOf(")") + 1).trim();
            }
        }

        if (textToParse.indexOf("Offensive Abilities") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Offensive Abilities"));
        }

        let attacks = textToParse.split(delimiter);
        for (let attack of attacks) {
            attack = attack.trim();
            if (attack.length > 1) {
                if (!(attack.startsWith("Space") || attack.startsWith("Reach") || attack.includes("ft"))) {
                    try {
                        armNPC(characterId, attack);
                    } catch (err) {
                        speakAsGuidanceToGM("Could not populate data for weapon " + attack);
                    }
                }
            }

        }
    };

    let armNPC = function (characterId, attackToParse) {
        debugLog("Parsing " + attackToParse);
        let uuid = generateRowID();

        let details = attackToParse.split(" ");
        let i = 0;
        let weapon = "";
        while (isNaN(details[i]) && i < details.length) {
            weapon = weapon + details[i] + " ";
            i++;
        }

        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-notes", attackToParse);
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-name", weapon);
        let attackBonus = details[i];
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-attack", attackBonus);
        i++;

        let damage = details[i].replace(/\(/, "");
        let numDice = damage.split("d");
        let dnd = numDice[1].split("+");
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-dice-num", numDice[0]);
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-die", dnd[0]);

        if (!isFalsy(dnd[1])) {
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-damage", dnd[1]);
        }
    };

    /////////////////////////////////////////////////////////////////
    // Parsing routines
    /////////////////////////////////////////////////////////////////
    let getSkillValue = function (skillName, attribute, textToParse) {
        if (parseFloat(getValue(skillName, textToParse).trim()) > 2) {
            debugLog(skillName + " : " + getValue(skillName, textToParse) + " - " + attribute + " : " + getValue(attribute, textToParse));
            return parseFloat(getValue(skillName, textToParse).trim()) - parseFloat(getValue(attribute, textToParse).trim());
        }
        return 0;
    };

    let getValue = function (textToFind, textToParse, delimiter) {
        let bucket = getStringValue(textToFind, textToParse, delimiter);
        if (isFalsy(bucket)) {
            return "";
        }
        let b2 = bucket.split(" ");
        bucket = b2[0];
        return bucket.replace(";", "").replace(",", " ").trim(); // replace("+", "")
    };

    let getStringValue = function (textToFind, textToParse, delimiter) {
        if (textToParse.indexOf(textToFind) < 0) {
            return "";
        }
        let start = textToParse.indexOf(textToFind) + textToFind.length;
        if (start < 0) {
            return "";
        }

        if (isFalsy(delimiter)) {
            delimiter = " ";
        }

        let bucket = textToParse.substring(start);
        if (delimiter !== ";") {
            // It appears that ; ALWAYS means end of field. This is a good safety
            if (bucket.indexOf(";") > 2) {
                bucket = bucket.substring(0, bucket.indexOf(";"));
            }
        }

        bucket = bucket.trim();
        let end = bucket.toLowerCase().indexOf(delimiter.toLowerCase());
        if (end > 1) {
            bucket = bucket.substring(0, end);
        }
        return bucket;
    };

    let cleanText = function (textToClean) {
        return textToClean.replace(/(<([^>]+)>)/gi, " "
        ).replace(/&nbsp;/gi, " "
        ).replace(/&amp;/gi, "&"
        ).replace(/&amp/gi, "&"
        ).replace(/\s+/g, " "
        ).replace(/Offense/i, " OFFENSE "
        ).replace(/Defense/i, " DEFENSE "
        ).replace(/Statistics/i, " STATISTICS "
        ).replace(/Ecology/i, "ECOLOGY "
        ).replace(/Special Abilities/i, " SPECIAL ABILITIES "
        ).replace(/Tactics/i, " TACTICS "
        ).replace(/ Str /i, " Str "
        ).replace(/ Dex /i, " Dex "
        ).replace(/ Con /i, " Con "
        ).replace(/ Int /i, " Int "
        ).replace(/ Wis /i, " Wis "
        ).replace(/ Cha /i, " Cha "
        );
    };

    let attributeToInteger = function (characterId, attrib) {
        let value = getAttribute(characterId, attrib);
        if (isFalsy(value)) {
            return 0;
        } else {
            return parseFloat(value.get("current"));
        }
    };

    //@formatter:off
    /////////////////////////////////////////////////////////////////
    // GENERIC HELPER ROUTINES
    /////////////////////////////////////////////////////////////////

    // Borrowed from https://app.roll20.net/users/104025/the-aaron
    let generateUUID = (function () {
            "use strict";

            let a = 0, b = [];
            return function () {
                let c = (new Date()).getTime() + 0, d = c === a;
                a = c;
                for (let e = new Array(8), f = 7; 0 <= f; f--) {
                    e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                    c = Math.floor(c / 64);
                }
                c = e.join("");
                if (d) {
                    for (let f = 11; 0 <= f && 63 === b[f]; f--) {
                        b[f] = 0;
                    }
                    b[f]++;
                } else {
                    for (let f = 0; 12 > f; f++) {
                        b[f] = Math.floor(64 * Math.random());
                    }
                }
                for (let f = 0; 12 > f; f++) {
                    c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
                }

                return c;
            };
        }()),
        generateRowID = function () {
            "use strict";
            return generateUUID().replace(/_/g, "Z");
        };

    let debugLog = function (text) {
        if (debugMode) {
            log(text);
        }
    };

    let speakAsGuidanceToGM = function (text) {
        text = "/w gm  &{template:pf_spell} {{name=Guidance}} {{spell_description=" + text + "}}";
        sendChat("Guidance", text);
    };

    //@formatter:on

    // This is used until I get a better handle on undefined vs null vs whatever....
    let isFalsy = function (v) {
        if (v === null) {
            return true;
        }
        if (v === undefined) {
            return true;
        }
        return false;
    };
}
());