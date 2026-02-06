
import { Mission, MissionType, MissionStatus } from './types';

const missionsCSVData = `1;02/02/2026;AG A25-0110;aloui.b;8;NON;WAGA Energy;
1;03/02/2026;AG A25-1129;aloui.b;8;NON;PRODEVAL ;588 Rue Elsa Triolet, 69360 Communay
1;04/02/2026;AG A25-1129;aloui.b;8;NON;PRODEVAL ;588 Rue Elsa Triolet, 69360 Communay
1;05/02/2026;HS A26-0014;aloui.b;8;NON;TLSP;402 Rue Pierre Cot, 69800 Venissieux
1;06/02/2026;HS A26-0014;aloui.b;7;NON;TLSP;402 Rue Pierre Cot, 69800 Venissieux
4;02/02/2026;AG A26-0089;aloui.r;8;NON;PRODEVAL ;588 Rue Elsa Triolet, 69360 Communay
4;03/02/2026;AG A26-0089;aloui.r;8;NON;PRODEVAL ;588 Rue Elsa Triolet, 69360 Communay
4;04/02/2026;AG A26-0089;aloui.r;8;NON;PRODEVAL ;588 Rue Elsa Triolet, 69360 Communay
4;05/02/2026;AG A26-0022;aloui.r;8;NON;PRODEVAL;588 Rue Elsa Triolet, 69360 Communay
4;06/02/2026;Conge;aloui.r;7;NON;CONGE;27 ZAC de Chassagne, 69360 Ternay
7;02/02/2026;AG A26-0022;assensi.e;8;NON;PRODEVAL;588 Rue Elsa Triolet, 69360 Communay
7;03/02/2026;HS A25-0861;assensi.e;8;NON;Ste GERMAIN;27 ZAC de Chassagne, 69360 Ternay
7;04/02/2026;HS A25-0861;assensi.e;8;NON;Ste GERMAIN;27 ZAC de Chassagne, 69360 Ternay
7;05/02/2026;AG A26-0022;assensi.e;8;NON;PRODEVAL;588 Rue Elsa Triolet, 69360 Communay
7;06/02/2026;AG A26-0022;assensi.e;7;NON;PRODEVAL;588 Rue Elsa Triolet, 69360 Communay
10;02/02/2026;FG A25-1147;bechaa.a;8;NON;VEOLIA;402 Rue Pierre Cot, 69800 Venissieux
10;03/02/2026;SD I26-0003;bechaa.a;8;NON;EPL;7 Rue d'Arles, 69007 Lyon
10;04/02/2026;CME0101;bechaa.a;8;NON;TOTAL ACS;3 Place du Bassin, 69700 Givors
10;05/02/2026;CME0101;bechaa.a;8;NON;TOTAL ACS;3 Place du Bassin, 69700 Givors`;

export const getInitialMissions = (): Mission[] => {
    return missionsCSVData.split('\n').map((line, i) => {
        const parts = line.trim().split(';');
        if (parts.length < 7) return null;

        const dateParts = parts[1].split('/');
        if (dateParts.length !== 3) return null;
        const date = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));

        const jobNumber = parts[2].trim().toUpperCase();
        let missionType = MissionType.WORK;
        if (jobNumber.includes('CONGE')) missionType = MissionType.LEAVE;
        
        const description = parts[6] ? parts[6].trim() : '';
        const address = parts[7] ? parts[7].trim() : '';
        
        const mission: Mission = {
            id: `mission-initial-${i}-${parts[3].trim()}`,
            date: date.toISOString(),
            jobNumber: jobNumber,
            workHours: parseFloat(parts[4]) || 0,
            travelHours: 0,
            overtimeHours: 0,
            type: missionType,
            status: MissionStatus.SUBMITTED,
            technicianId: parts[3].trim(),
            managerInitials: 'RG', // Default manager
            igd: parts[5].toUpperCase() === 'OUI',
            description: description,
            address: address,
        };
        return mission;
    }).filter((m): m is Mission => m !== null);
};