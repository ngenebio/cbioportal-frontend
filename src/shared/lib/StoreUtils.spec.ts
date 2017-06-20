import {
    fetchCosmicData, fetchOncoKbData, makeStudyToCancerTypeMap,
    mergeMutationsIncludingUncalled, generateMutationIdByEvent, generateMutationIdByGeneAndProteinChangeAndEvent
} from "./StoreUtils";
import * as _ from 'lodash';
import { assert } from 'chai';
import sinon from 'sinon';
import {MobxPromise} from "mobxpromise";
import {CancerStudy, Mutation} from "../api/generated/CBioPortalAPI";
import {initMutation} from "test/MutationMockUtils";

describe('StoreUtils', () => {

    let emptyMutationData: MobxPromise<Mutation[]>;
    let emptyUncalledMutationData: MobxPromise<Mutation[]>;
    let mutationDataWithNoKeyword: MobxPromise<Mutation[]>;
    let mutationDataWithKeywords: MobxPromise<Mutation[]>;
    let mutationDataWithFusionsOnly: MobxPromise<Mutation[]>;
    let mutationDataWithMutationsOnly: MobxPromise<Mutation[]>;
    let mutationDataWithBothMutationsAndFusions: MobxPromise<Mutation[]>;

    before(() => {
        emptyMutationData =  {
            result: [],
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };

        mutationDataWithNoKeyword =  {
            result: [{}, {}] as Mutation[],
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };

        mutationDataWithKeywords =  {
            result: [{keyword:"one"}] as Mutation[],
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };

        emptyUncalledMutationData =  {
            result: [],
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };


        const fusions: Mutation[] = [
            initMutation({gene: { // fusion for ERG
                hugoGeneSymbol: "ERG",
                proteinChange: "TMPRSS2-ERG fusion"
            }}),
            initMutation({gene: { // same fusion for TMPRSS2
                hugoGeneSymbol: "TMPRSS2",
                proteinChange: "TMPRSS2-ERG fusion"
            }}),
            initMutation({gene: { // different fusion
                hugoGeneSymbol: "FOXP1",
                proteinChange: "FOXP1-intragenic"
            }}),
        ];

        const mutations: Mutation[] = [
            initMutation({ // mutation
                gene: {
                    chromosome: "X",
                    hugoGeneSymbol: "TP53",
                },
                proteinChange: "mutated",
                startPosition: 100,
                endPosition: 100,
                referenceAllele: "A",
                variantAllele: "T"
            }),
            initMutation({ // another mutation with the same mutation event
                gene: {
                    chromosome: "X",
                    hugoGeneSymbol: "TP53"
                },
                proteinChange: "mutated",
                startPosition: 100,
                endPosition: 100,
                referenceAllele: "A",
                variantAllele: "T"
            }),
            initMutation({ // mutation with different mutation event
                gene: {
                    chromosome: "Y",
                    hugoGeneSymbol: "PTEN"
                },
                proteinChange: "mutated",
                startPosition: 111,
                endPosition: 112,
                referenceAllele: "T",
                variantAllele: "A"
            }),
        ];

        mutationDataWithFusionsOnly =  {
            result: fusions,
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };

        mutationDataWithMutationsOnly =  {
            result: mutations,
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };

        mutationDataWithBothMutationsAndFusions = {
            result: [...mutations, ...fusions],
            status: 'complete' as 'complete',
            isPending: false,
            isError: false,
            isComplete: true,
            error: undefined
        };
    });

    after(() => {

    });

    describe('fetchCosmicCount', () => {

        it("won't fetch cosmic data if there are no mutations", (done) => {
            const fetchStub = sinon.stub();
            const internalClient = {
                fetchCosmicCountsUsingPOST: fetchStub
            };

            fetchCosmicData(emptyMutationData, emptyUncalledMutationData, internalClient as any).then((data: any) => {
                assert.isUndefined(data);
                assert.isFalse(fetchStub.called);
                done();
            });
        });

        it("won't fetch cosmic data if there ARE mutations, but none with keywords", (done) => {
            const fetchStub = sinon.stub();
            const internalClient = {
                fetchCosmicCountsUsingPOST: fetchStub
            };

            fetchCosmicData(mutationDataWithNoKeyword, emptyUncalledMutationData, internalClient as any).then((data: any) => {
                assert.isUndefined(data);
                assert.isFalse(fetchStub.called);
                done();
            });
        });

        it('will fetch cosmic data if there are mutations with keywords', (done) => {
            const fetchStub = sinon.stub();
            fetchStub.returns(Promise.resolve([]));

            const internalClient = {
                fetchCosmicCountsUsingPOST: fetchStub
            };

            fetchCosmicData(mutationDataWithKeywords, emptyUncalledMutationData, internalClient as any).then((data: any) => {
                //assert.isUndefined(data);
                assert.isTrue(fetchStub.called);
                done();
            });
        });
    });

    describe('makeStudyToCancerTypeMap', ()=>{
        let studies:CancerStudy[];
        before(()=>{
            studies = [];
            studies.push({
                studyId: "0",
                cancerType: {
                    name: "ZERO"
                }
            } as CancerStudy);
            studies.push({
                studyId: "1",
                cancerType: {
                    name: "ONE"
                }
            } as CancerStudy);
            studies.push({
                studyId: "2",
                cancerType: {
                    name: "TWO"
                }
            } as CancerStudy);
            studies.push({
                studyId: "3",
                cancerType: {
                    name: "three"
                }
            } as CancerStudy);
        });

        it('gives empty map if no studies', ()=>{
            assert.deepEqual(makeStudyToCancerTypeMap([]), {});
        });
        it('handles one study properly', ()=>{
            assert.deepEqual(makeStudyToCancerTypeMap([studies[0]]), { 0: "ZERO" });
        });
        it('handles more than one study properly', ()=>{
            assert.deepEqual(makeStudyToCancerTypeMap([studies[1], studies[2]]), { 1: "ONE", 2:"TWO" });
            assert.deepEqual(makeStudyToCancerTypeMap([studies[2], studies[1], studies[3]]), { 1:"ONE", 2:"TWO", 3:"three" });
            assert.deepEqual(makeStudyToCancerTypeMap(studies), { 0: "ZERO", 1:"ONE", 2:"TWO", 3:"three" });
        });
    });

    describe('mergeMutationsIncludingUncalled', () => {
        it("merges mutations properly when there is only fusion data", () => {
            const mergedFusions = mergeMutationsIncludingUncalled(mutationDataWithFusionsOnly, emptyMutationData);

            assert.equal(mergedFusions.length, 3);
        });

        it("merges mutations properly when there is only mutation data", () => {
            const mergedMutations = mergeMutationsIncludingUncalled(mutationDataWithMutationsOnly, emptyMutationData);

            assert.equal(mergedMutations.length, 2);

            const sortedMutations = _.sortBy(mergedMutations, "length");

            assert.equal(sortedMutations[0].length, 1);
            assert.equal(sortedMutations[1].length, 2);

            assert.equal(generateMutationIdByGeneAndProteinChangeAndEvent(sortedMutations[1][0]),
                generateMutationIdByGeneAndProteinChangeAndEvent(sortedMutations[1][1]),
                "mutation ids of merged mutations should be same");

            assert.equal(generateMutationIdByEvent(sortedMutations[1][0]),
                generateMutationIdByEvent(sortedMutations[1][1]),
                "event based mutation ids of merged mutations should be same, too");
        });

        it("merges mutations properly when there are both mutation and fusion data ", () => {
            const mergedMutations = mergeMutationsIncludingUncalled(mutationDataWithBothMutationsAndFusions, emptyMutationData);

            assert.equal(mergedMutations.length, 5);
        });
    });

    it("won't fetch onkokb data if there are no mutations", (done) => {
        fetchOncoKbData({}, emptyMutationData).then((data: any) => {
            assert.deepEqual(data, {sampleToTumorMap: {}, indicatorMap: {}});
            done();
        });
    });
});