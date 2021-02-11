# Guidance
API for Roll20 and Starfinder
Currently in Beta for 1.0. - Grab it and try it!

This is a tool to support the usage of the Starfinder (Simple) character sheets in Roll20. 
Currently, Guidance doesn't handle the official Roll20 character sheets at this time.

The goal with version 1 is to be able to import statblocks from Archive of Nethys, the Roll20 Starfinder compendiums, and the StarjammerSRD into the NPC tab of the Starfinder (Simple) character sheet.

Currently there are two main functions. Click on a token that has been linked to a character sheet, and run this.

!sf_populate - When a token has been linked to a character sheet, it will read the statblock from the GM Notes section  of the character and populate the values. It also configures other details about the linked token such as HPs and ACs.
usage :  !sf_populate

!sf_clean - this will erase an entire character sheet. Note that you must type "CONFIRM" to allow it to delete.
usage:  !sf_clean CONFIRM
