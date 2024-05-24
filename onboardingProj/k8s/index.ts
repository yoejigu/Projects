import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as k8s from "@pulumi/kubernetes";

const eksStack = new pulumi.StackReference("ytejigu/onboardingProj/dev");
const eksKubeConfig = eksStack.getOutput("kConfig");
const eksProvider = eksStack.getOutput("eksProvider");

const name = "onboard";
const kProvider = new k8s.Provider("kprovider",{
    kubeconfig: eksKubeConfig,
    
})

const ns = new k8s.core.v1.Namespace(name, {}, { provider: kProvider});

//const appLabels = {app: "nginx"};

/*
    -Deployment is a template for creating pods

*/
const appLabels = { appClass: name };
const deployment = new k8s.apps.v1.Deployment(name, {
    metadata:{
        namespace: ns.metadata.name,
        labels: appLabels,
    },
    spec: {
        replicas: 1,                                                        
        selector: {matchLabels: appLabels},
        template: {
            metadata:{
                labels: appLabels,
            },
            spec:{
                containers:[
                    {
                        name: name,
                        image: "nginx:latest",
                        ports: [{name: "http", containerPort: 80}],
                    },
                ]
            }
        }

        

    }
},{
    provider: kProvider,
});

export const deploymentName = deployment.metadata.name;

const service = new k8s.core.v1.Service(name,{
    metadata:{
        labels: appLabels,
        namespace: ns.metadata.name,
    },
    spec:{
        type: "LoadBalancer",
        ports: [{ port: 80, targetPort: "http"}],
        selector: appLabels,
    }
}, {provider: kProvider});

export const serviceName = service.metadata.name;
export const serviceHostName = service.status.loadBalancer.ingress[0].hostname;