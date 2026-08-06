# Cybercore Source Research Notes

**Research date:** 2026-08-06

**Author:** Manus AI

These notes preserve the authoritative findings used to build the source-evidence batch. A record is not promoted merely because a program exists; source authenticity, issuer, identifier, deadline, specificity, and temporal actionability are evaluated separately.

| Intake record | Authoritative finding | Operational interpretation | Source |
|---|---|---|---|
| NSF AI Infrastructure Hubs | NSF 26-513 is an active solicitation posted July 31, 2026, with a November 4, 2026 first deadline and $40–$100 million anticipated funding. | Specific and open; organizational eligibility still requires human review. | [1] |
| NSF E-RISE | NSF 25-522 is the current recurring solicitation and states “Second Tuesday in August, Annually Thereafter.” | The 2026 deadline is deterministically derived as August 11 from the authoritative recurrence rule, rather than copied from a printed 2026 date. | [2] |
| NIH Neuroscience Forecast | FOR-NS-25-004 is a forecast for the ACTION Potential F99/K00 program; the notice did not solicit applications. | Verified forecast, not an active application opportunity from this notice. | [3] |
| DOE ARPA-E HORNIG | HORNIG identifies DE-FOA-0003623, an April 23, 2026 release, up to $50 million, and an August 6, 2026 full-application deadline. | Specific; deadline-day status requires immediate human cutoff confirmation. | [4] [5] |
| CDMRP Biomedical Programs | CDMRP maintains many FY26 research programs rather than one solicitation with the intake title. | Verified program category only. | [6] |
| Centers Aligned with Areas for National Need | ED-GRANTS-060526-001 was posted June 5 and closed July 7, 2026, with $70 million program funding. | Specific but historical for new submission. | [7] |
| Promise Neighborhoods | ED-GRANT-26-054 has an August 6, 2026 closing date and $65 million program funding. | Specific; deadline-day status requires human cutoff confirmation. | [8] |
| HUD Fair Housing Programs | OFH-2600-DC-021A is the Fair Housing Initiatives Program Education and Outreach Initiative closing November 2, 2026. | Specific and open. | [9] |
| ACL/NIDILRR Programs | NIDILRR administers multiple research, engineering, training, and small-business programs. | Verified program category; one specific NOFO is required. | [10] |
| USDA Acer Access Program | USDA-AMS-TM-ACER-G-26-0007 closed July 7, 2026; listed program funding is $5 million. | Specific but historical for new submission. | [11] |
| Coast Guard Recreational Boating Safety | DHS-USCG-NONPROFIT-2026 closed July 7, 2026, with $6,592,499 program funding. | Specific but historical for new submission. | [12] |
| International Public Diplomacy Grants | SAM.gov Assistance Listing 19.040 verifies the Department of State Public Diplomacy Programs category. | Standing assistance category; a specific announcement is required for a deadline. | [13] |
| Rapid Assured Access | HQ072726RE001 had a July 27, 2026 offers-due date. | Specific notice, but the proposal deadline passed. | [14] |
| FAA Strategic Sourcing | 697DCK-25-R-00302 concerns the SAVES procurement and had a September 18, 2025 proposal deadline. | Specific procurement vehicle, closed to new proposals based on the observed deadline. | [15] |
| DHS Maritime Domain Awareness CSO | 70RDA125R00000013 is inactive and had an August 5, 2026 offers-due date. | Specific but historical for new submissions. | [16] |
| World Bank Consulting Opportunities | World Bank operational consulting is a standing procurement channel using VMP and RFxNow. | Verified procurement category, not one solicitation. | [17] |
| UNDP Supplier Opportunities | UNDP Procurement and Quantum are standing supplier and procurement channels. | Verified procurement category, not one solicitation. | [18] [19] |
| NASA Strategic Technology Opportunities | NASA STMD maintains a portfolio containing multiple distinct solicitations and opportunities. | Verified discovery category; a specific child opportunity is required. | [20] |
| World Bank SAF Supply-Chain Assessment | World Bank solicitation 0002022855 was issued July 10 and closed August 5, 2026, for a Kenya SAF assessment. | Specific but historical for submission. | [21] |
| Transit Infrastructure Modernization Programs | No exact authoritative opportunity matching the broad title was established. | Remains unverified. | — |
| Education and Community Infrastructure Programs | No exact authoritative opportunity matching the broad title was established. | Remains unverified. | — |
| Accelerator and Prize Pathways | No exact authoritative opportunity with the intake title was established; NASA separately maintains named prize and challenge opportunities. | Keep the generic record unverified and discover specific child records separately. | [22] |

## Design implications

Verification separates **source authenticity**, **program identity**, **specific opportunity identity**, and **temporal actionability**. `VERIFIED_PROGRAM` and generic records cannot enter the actionable commercial pipeline as if they were open solicitations. Deadline evaluation distinguishes `OPEN`, `DEADLINE_TODAY`, `CLOSED`, `FORECAST`, `PROGRAM_ONLY`, and `UNKNOWN`.

Future evidence imports preserve retrieval timestamps and HTTPS source URLs, record which fields were directly verified, and fail closed on malformed evidence. Strategic scoring is restricted to strictly verified records; actionable commercialization additionally requires an open temporal state.

## References

[1]: https://www.nsf.gov/funding/opportunities/us-national-science-foundation-state-regional-artificial/nsf26-513/solicitation "NSF 26-513"
[2]: https://www.nsf.gov/funding/opportunities/e-rise-epscor-research-infrastructure-improvement-program-epscor/nsf25-522/solicitation "NSF 25-522"
[3]: https://simpler.grants.gov/opportunity/79bade5f-509e-483b-9823-3efc52c2f3c5 "NIH ACTION Potential forecast"
[4]: https://arpa-e.energy.gov/programs-and-initiatives/view-all-programs/hornig "ARPA-E HORNIG"
[5]: https://arpa-e-foa.energy.gov/ "ARPA-E eXCHANGE"
[6]: https://cdmrp.health.mil/researchprograms "CDMRP research programs"
[7]: https://simpler.grants.gov/opportunity/4bc86bcb-84d9-4bb0-bb5b-4a6732de7952 "CAANN"
[8]: https://simpler.grants.gov/opportunity/570d18d4-f665-48ed-bf1e-57e8b6789186 "Promise Neighborhoods"
[9]: https://simpler.grants.gov/opportunity/224cb740-46ae-4eab-bdb5-d858638ee591 "HUD Fair Housing"
[10]: https://acl.gov/about-acl/about-national-institute-disability-independent-living-and-rehabilitation-research "NIDILRR"
[11]: https://simpler.grants.gov/opportunity/b81c339c-7aee-4669-b96a-36d31a8ac32d "USDA Acer Access"
[12]: https://simpler.grants.gov/opportunity/3a00c080-6e85-4eb2-8a51-c055436e9b18 "Coast Guard Recreational Boating Safety"
[13]: https://sam.gov/fal/b46f108001414cec8b6d67f7f80013bf/view "Public Diplomacy Programs assistance listing"
[14]: https://sam.gov/opp/82153d5a0d5a49178d9e50137a7bae92/view "Rapid Assured Access"
[15]: https://sam.gov/opp/1fa18c9540ab4976b07167b41d93317c/view "FAA SAVES"
[16]: https://sam.gov/opp/32923c9e47ed4f6b828c8bd0531c1286/view "DHS Maritime Capabilities and Innovation CSO"
[17]: https://www.worldbank.org/en/about/corporate-procurement/business-opportunities/operational-consulting-opportunities "World Bank operational consulting"
[18]: https://www.undp.org/procurement "UNDP procurement"
[19]: https://procurement-notices.undp.org/ "UNDP procurement notices"
[20]: https://www.nasa.gov/stmd-solicitations-and-opportunities/ "NASA STMD solicitations and opportunities"
[21]: https://www.worldbank.org/en/about/corporate-procurement/business-opportunities/administrative-procurement/rfxnow-2022855-feedstock-supply-chain-logistics-and-refinery-port-interface-assessment-for-saf-production-in-ke "World Bank solicitation 0002022855"
[22]: https://www.nasa.gov/prizes-challenges-and-crowdsourcing/ "NASA prizes, challenges, and crowdsourcing"
