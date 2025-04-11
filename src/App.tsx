import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Network, AlertCircle, CheckCircle2, Timer, Command, HelpCircle, Database, Server } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface Pod {
  name: string;
  status: string;
  ready: boolean;
  restarts: number;
  logs?: string[];
  age: string;
  ip: string;
  node: string;
}

interface ClusterState {
  pods: Pod[];
  secrets: {
    'db-secret': {
      DB_PASSWORD?: string;
    };
  };
  deployments: {
    'auth-service': {
      replicas: number;
      availableReplicas: number;
      env: Array<{ name: string; valueFrom?: { secretKeyRef?: { name: string; key: string } } }>;
    };
  };
}

const initialClusterState: ClusterState = {
  pods: [
    { 
      name: 'frontend-6d5bc7b947-x8v2n',
      status: 'Running',
      ready: true,
      restarts: 0,
      age: '10m',
      ip: '10.244.0.12',
      node: 'node-1'
    },
    { 
      name: 'auth-service-5f7d9c8b6d-j4k2h',
      status: 'CrashLoopBackOff',
      ready: false,
      restarts: 5,
      logs: [
        '[2025-03-20 10:15:32] Starting auth service...',
        '[2025-03-20 10:15:32] Checking configuration...',
        '[2025-03-20 10:15:32] ERROR: Environment variable DB_PASSWORD not set',
        '[2025-03-20 10:15:32] Failed to initialize database connection',
        '[2025-03-20 10:15:32] Service startup failed'
      ],
      age: '10m',
      ip: '10.244.0.13',
      node: 'node-1'
    },
    { 
      name: 'postgresql-0',
      status: 'Running',
      ready: true,
      restarts: 0,
      age: '10m',
      ip: '10.244.0.14',
      node: 'node-1'
    }
  ],
  secrets: {
    'db-secret': {}
  },
  deployments: {
    'auth-service': {
      replicas: 1,
      availableReplicas: 0,
      env: []
    }
  }
};

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal>();
  const [clusterState, setClusterState] = useState<ClusterState>(initialClusterState);
  const [currentStep, setCurrentStep] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [commandCount, setCommandCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentCommand, setCurrentCommand] = useState('');
  const currentLineBufferRef = useRef('');

  useEffect(() => {
    const initTerminal = () => {
      if (!terminalRef.current || xtermRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selection: '#444444',
          black: '#000000',
          red: '#cc0000',
          green: '#4e9a06',
          yellow: '#c4a000',
          blue: '#3465a4',
          magenta: '#75507b',
          cyan: '#06989a',
          white: '#d3d7cf',
          brightBlack: '#555753',
          brightRed: '#ef2929',
          brightGreen: '#8ae234',
          brightYellow: '#fce94f',
          brightBlue: '#729fcf',
          brightMagenta: '#ad7fa8',
          brightCyan: '#34e2e2',
          brightWhite: '#eeeeec'
        }
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      fitAddon.fit();
      term.focus();

      window.addEventListener('resize', () => {
        fitAddon.fit();
      });

      term.writeln('Welcome to Kubernetes Troubleshooting Simulator!');
      term.writeln('Scenario: Fix the CrashLoopBackOff in auth-service');
      term.writeln('');
      term.writeln('Type "help" for available commands.');
      term.write('\r\n$ ');

      term.onData(data => {
        // Handle paste events
        if (data.length > 1) {
          const lines = data.split(/\r?\n/);
          if (lines.length > 1) {
            // Handle multi-line paste
            lines.forEach((line, i) => {
              if (i === 0) {
                // First line gets appended to current command
                currentLineBufferRef.current += line;
                term.write(line);
              } else {
                // Subsequent lines trigger new commands
                term.write('\r\n');
                handleCommand(currentLineBufferRef.current);
                currentLineBufferRef.current = line;
                term.write('$ ' + line);
              }
            });
          } else {
            // Single line paste
            currentLineBufferRef.current += data;
            term.write(data);
          }
        }
      });

      term.onKey(({ key, domEvent }) => {
        const ev = domEvent;
        const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

        if (ev.keyCode === 13) { // Enter
          term.write('\r\n');
          if (currentLineBufferRef.current.trim().length > 0) {
            handleCommand(currentLineBufferRef.current);
          }
          currentLineBufferRef.current = '';
          term.write('$ ');
        } else if (ev.keyCode === 8) { // Backspace
          if (currentLineBufferRef.current.length > 0) {
            currentLineBufferRef.current = currentLineBufferRef.current.slice(0, -1);
            term.write('\b \b');
          }
        } else if (printable) {
          currentLineBufferRef.current += key;
          term.write(key);
        }
      });

      xtermRef.current = term;

      return () => {
        window.removeEventListener('resize', () => fitAddon.fit());
        term.dispose();
      };
    };

    initTerminal();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCommand = (command: string) => {
    if (!command.trim()) return;

    setCommandCount(prev => prev + 1);
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    const term = xtermRef.current;
    if (!term) return;

    const writeLines = (lines: string[]) => {
      lines.forEach(line => {
        term.writeln(line);
      });
    };

    if (command === 'help') {
      writeLines([
        'Available commands:',
        '  kubectl get pods           - List all pods',
        '  kubectl describe pod NAME  - Show details of a pod',
        '  kubectl logs NAME         - Show logs of a pod',
        '  kubectl edit deployment NAME - Edit a deployment',
        '  clear                     - Clear the terminal',
        '  help                      - Show this help message'
      ]);
    } else if (command === 'clear') {
      term.clear();
    } else if (command === 'kubectl get pods') {
      writeLines([
        'NAME                         READY   STATUS              RESTARTS   AGE',
        ...clusterState.pods.map(pod => 
          `${pod.name.padEnd(28)} ${pod.ready ? '1/1' : '0/1'}     ${pod.status.padEnd(20)} ${pod.restarts}          ${pod.age}`
        )
      ]);
    } else if (command.startsWith('kubectl logs')) {
      const podName = command.split(' ')[2];
      const pod = clusterState.pods.find(p => p.name.startsWith(podName));
      if (pod?.logs) {
        writeLines(pod.logs);
      } else {
        term.writeln(`Error: pod "${podName}" not found`);
      }
    } else if (command.startsWith('kubectl describe pod')) {
      const podName = command.split(' ')[3];
      const pod = clusterState.pods.find(p => p.name.startsWith(podName));
      if (pod) {
        writeLines([
          `Name:         ${pod.name}`,
          `Namespace:    default`,
          `Priority:     0`,
          `Node:         ${pod.node}`,
          `Start Time:   ${pod.age} ago`,
          `Labels:       app=${pod.name.split('-')[0]}`,
          `Status:       ${pod.status}`,
          `IP:           ${pod.ip}`,
          'IPs:',
          `  IP:  ${pod.ip}`,
          'Containers:',
          `  ${pod.name.split('-')[0]}:`,
          '    Container ID:  docker://1234567890abcdef',
          `    Image:         ${pod.name.split('-')[0]}:latest`,
          '    Image ID:      docker-pullable://registry.k8s.io/pause:3.9',
          `    Port:          ${pod.name.includes('postgresql') ? '5432/TCP' : '8080/TCP'}`,
          `    Host Port:     0/TCP`,
          `    State:         ${pod.status}`,
          `    Ready:         ${pod.ready}`,
          `    Restart Count: ${pod.restarts}`,
          'Events:'
        ]);
        
        if (pod.status === 'CrashLoopBackOff') {
          writeLines([
            '  Type     Reason     Age                From               Message',
            '  ----     ------     ----               ----               -------',
            '  Normal   Scheduled  10m                default-scheduler  Successfully assigned default/auth-service to node-1',
            '  Warning  BackOff    9m (x5 over 10m)   kubelet           Back-off restarting failed container'
          ]);
        }
      } else {
        term.writeln(`Error: pod "${podName}" not found`);
      }
    } else if (command.startsWith('kubectl edit deployment')) {
      const deploymentName = command.split(' ')[3];
      if (deploymentName === 'auth-service') {
        writeLines([
          '# Please edit the object below. Lines beginning with a "#" will be ignored.',
          'apiVersion: apps/v1',
          'kind: Deployment',
          'metadata:',
          '  name: auth-service',
          'spec:',
          '  template:',
          '    spec:',
          '      containers:',
          '      - name: auth-service',
          '        env:',
          '        - name: DB_PASSWORD',
          '          valueFrom:',
          '            secretKeyRef:',
          '              name: db-secret',
          '              key: DB_PASSWORD',
          '',
          '# Configuration updated. Applying changes...'
        ]);
        
        setTimeout(() => {
          setClusterState(prev => ({
            ...prev,
            deployments: {
              ...prev.deployments,
              'auth-service': {
                ...prev.deployments['auth-service'],
                env: [{
                  name: 'DB_PASSWORD',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'db-secret',
                      key: 'DB_PASSWORD'
                    }
                  }
                }]
              }
            },
            pods: prev.pods.map(pod => 
              pod.name.startsWith('auth-service') 
                ? { ...pod, status: 'Running', ready: true, restarts: pod.restarts + 1 }
                : pod
            )
          }));
          setCurrentStep(4);
          writeLines([
            'deployment.apps/auth-service edited',
            'Waiting for deployment "auth-service" rollout to finish: 0 of 1 updated replicas are available...',
          ]);
          setTimeout(() => {
            term.writeln('deployment "auth-service" successfully rolled out');
          }, 1000);
        }, 2000);
      }
    } else {
      term.writeln(`Error: unknown command "${command}"`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Network className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">K8s Troubleshooting Simulator</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Timer className="w-5 h-5 text-gray-400" />
              <span className="text-gray-400">Time: {formatTime(elapsedTime)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Command className="w-5 h-5 text-gray-400" />
              <span className="text-gray-400">Commands: {commandCount}</span>
            </div>
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center space-x-2 text-gray-400 hover:text-gray-300"
            >
              <HelpCircle className="w-5 h-5" />
              <span>Hint</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 grid grid-cols-12 gap-4">
        <div className="col-span-4 space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Cluster Overview</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  <span>Nodes</span>
                </div>
                <span className="text-gray-300">1 active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-purple-400" />
                  <span>Pods</span>
                </div>
                <span className="text-gray-300">{clusterState.pods.length} total</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Pod Status</h2>
            <div className="space-y-4">
              {clusterState.pods.map(pod => (
                <div key={pod.name} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                  {pod.ready ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{pod.name}</p>
                    <p className={`text-sm ${pod.ready ? 'text-green-400' : 'text-red-400'}`}>
                      {pod.status}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <span>Restarts: {pod.restarts}</span>
                      <span>•</span>
                      <span>Age: {pod.age}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {showHint && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="p-3 bg-blue-900/50 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">Hint</h3>
                <p className="text-sm text-gray-300">
                  Check the logs of the auth-service pod to see why it's failing. You might need to configure environment variables in the deployment.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-8 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <TerminalIcon className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Terminal</h2>
          </div>
          <div className="bg-black rounded-lg p-1 h-[600px]">
            <div ref={terminalRef} className="h-full" />
          </div>
        </div>

        <div className="col-span-12 bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Scenario Progress</h2>
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="h-2 bg-gray-700 rounded-full">
                <div 
                  className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                ></div>
              </div>
            </div>
            <span className="ml-4 text-gray-400">Step {currentStep}/5</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;